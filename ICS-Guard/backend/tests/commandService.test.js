import mongoose from 'mongoose';
import { SimulatorCommand, Device } from '../src/models/index.js';
import {
  issueSecurityCommand,
  processCommandAck,
  checkAndExpireCommands,
} from '../src/services/commandService.js';

describe('CommandService & State Machine Unit Tests', () => {
  let testDevice;
  const successfulPublisher = async () => true;

  beforeAll(async () => {
    mongoose.set('bufferCommands', true);
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ics_guard_test';
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      } catch (err) {
        console.warn('MongoDB offline during unit tests:', err.message);
      }
    }
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      try {
        await Device.deleteMany({ _id: /^test-cmd-dev/ });
        await SimulatorCommand.deleteMany({ target_id: /^test-cmd-dev/ });
        await mongoose.connection.close();
      } catch (e) {}
    }
  }, 30000);

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      const devId = `test-cmd-dev-${Date.now()}`;
      testDevice = await Device.create({
        _id: devId,
        name: 'Test PLC',
        type: 'controller',
        zone: 'purdue-l1',
        source_id: 'hardware-01',
        ipAddress: '192.168.1.50',
        macAddress: '00:1A:2B:3C:4D:5E',
        status: 'active',
        security_status: 'normal'
      });
    }
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1 && testDevice) {
      await Device.deleteOne({ _id: testDevice._id });
      await SimulatorCommand.deleteMany({ target_id: testDevice._id });
    }
  });

  test('1. Issue Isolate Command should set device security_status to isolation_pending', async () => {
    if (mongoose.connection.readyState === 0) return;
    const cmd = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: testDevice._id,
      requested_by: 'analyst1',
      publisher: successfulPublisher,
    });

    expect(cmd.command_id).toBeDefined();
    expect(cmd.status).toBe('pending');

    const updatedDev = await Device.findById(testDevice._id);
    expect(updatedDev.security_status).toBe('isolation_pending');
  });

  test('2. Process Succeeded ACK for Isolate should set security_status to isolated', async () => {
    if (mongoose.connection.readyState === 0) return;
    const cmd = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: testDevice._id,
      requested_by: 'analyst1',
      publisher: successfulPublisher,
    });

    const ack = {
      command_id: cmd.command_id,
      command_type: 'isolate',
      runtime_id: 'hardware-01',
      target_id: testDevice._id,
      status: 'SUCCEEDED',
      result_message: 'Device isolated successfully'
    };

    const res = await processCommandAck(ack);
    expect(res).toBe(true);

    const updatedCmd = await SimulatorCommand.findOne({ command_id: cmd.command_id });
    expect(updatedCmd.status).toBe('succeeded');

    const updatedDev = await Device.findById(testDevice._id);
    expect(updatedDev.security_status).toBe('isolated');
  });

  test('3. Process Failed ACK for Isolate should revert security_status to normal', async () => {
    if (mongoose.connection.readyState === 0) return;
    const cmd = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: testDevice._id,
      requested_by: 'analyst1',
      publisher: successfulPublisher,
    });

    const ack = {
      command_id: cmd.command_id,
      command_type: 'isolate',
      runtime_id: 'hardware-01',
      target_id: testDevice._id,
      status: 'FAILED',
      result_message: 'Network link timeout'
    };

    await processCommandAck(ack);

    const updatedCmd = await SimulatorCommand.findOne({ command_id: cmd.command_id });
    expect(updatedCmd.status).toBe('failed');

    const updatedDev = await Device.findById(testDevice._id);
    expect(updatedDev.security_status).toBe('normal');
  });

  test('4. Process Failed ACK for Rollback should keep device isolated (fail-closed)', async () => {
    if (mongoose.connection.readyState === 0) return;
    // Set device to isolated first
    testDevice.security_status = 'isolated';
    await testDevice.save();

    const cmd = await issueSecurityCommand({
      command_type: 'rollback',
      target_id: testDevice._id,
      requested_by: 'admin',
      publisher: successfulPublisher,
    });

    const ack = {
      command_id: cmd.command_id,
      command_type: 'rollback',
      runtime_id: 'hardware-01',
      target_id: testDevice._id,
      status: 'FAILED',
      result_message: 'PLC logic restore checksum error'
    };

    await processCommandAck(ack);

    const updatedCmd = await SimulatorCommand.findOne({ command_id: cmd.command_id });
    expect(updatedCmd.status).toBe('failed');

    const updatedDev = await Device.findById(testDevice._id);
    expect(updatedDev.security_status).toBe('isolated'); // Fail-closed
  });

  test('5. Duplicate ACK should be ignored idempotently without error', async () => {
    if (mongoose.connection.readyState === 0) return;
    const cmd = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: testDevice._id,
      requested_by: 'admin',
      publisher: successfulPublisher,
    });

    const ack = {
      command_id: cmd.command_id,
      command_type: 'isolate',
      runtime_id: 'hardware-01',
      target_id: testDevice._id,
      status: 'SUCCEEDED',
      result_message: 'Device isolated'
    };

    // First ACK
    await processCommandAck(ack);

    // Second Duplicate ACK
    const dupRes = await processCommandAck(ack);
    expect(dupRes).toBe(true);

    const updatedCmd = await SimulatorCommand.findOne({ command_id: cmd.command_id });
    expect(updatedCmd.status).toBe('succeeded');
  });

  test('6. Broker publish failure should fail command and restore device state', async () => {
    if (mongoose.connection.readyState === 0) return;
    await expect(issueSecurityCommand({
      command_type: 'isolate',
      target_id: testDevice._id,
      requested_by: 'admin',
      publisher: async () => {
        throw new Error('broker unavailable');
      },
    })).rejects.toMatchObject({ status: 503 });

    const command = await SimulatorCommand.findOne({ target_id: testDevice._id });
    const device = await Device.findById(testDevice._id);
    expect(command.status).toBe('failed');
    expect(command.active_target).toBeUndefined();
    expect(device.security_status).toBe('normal');
  });

  test('7. ACK with mismatched runtime should be rejected', async () => {
    if (mongoose.connection.readyState === 0) return;
    const command = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: testDevice._id,
      requested_by: 'admin',
      publisher: successfulPublisher,
    });

    const accepted = await processCommandAck({
      command_id: command.command_id,
      command_type: 'isolate',
      runtime_id: 'other-runtime',
      target_id: testDevice._id,
      status: 'succeeded',
    });
    expect(accepted).toBe(false);
    const unchanged = await SimulatorCommand.findOne({ command_id: command.command_id });
    expect(unchanged.status).toBe('pending');
  });

  test('8. Expired command should require reconciliation', async () => {
    if (mongoose.connection.readyState === 0) return;
    const command = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: testDevice._id,
      requested_by: 'admin',
      publisher: successfulPublisher,
    });
    await SimulatorCommand.updateOne(
      { command_id: command.command_id },
      { $set: { expires_at: new Date(Date.now() - 1000) } }
    );

    expect(await checkAndExpireCommands()).toBe(1);
    const expired = await SimulatorCommand.findOne({ command_id: command.command_id });
    const device = await Device.findById(testDevice._id);
    expect(expired.status).toBe('expired');
    expect(device.security_status).toBe('reconciliation_required');
  });
});
