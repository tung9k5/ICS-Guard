import mongoose from 'mongoose';
import { Device, SystemMetadata } from '../src/models/index.js';
import {
  applyHardwareSnapshot,
  calculateCanonicalChecksum,
} from '../src/services/snapshotService.js';

describe('Hardware snapshot projection', () => {
  const runtimeId = 'snapshot-test-runtime';

  beforeAll(async () => {
    mongoose.set('bufferCommands', true);
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ics_guard_test', { serverSelectionTimeoutMS: 5000 });
      } catch (err) {
        console.warn('MongoDB offline during unit tests:', err.message);
      }
    }
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      try {
        await Device.deleteMany({ source_id: runtimeId });
        await SystemMetadata.deleteMany({ _id: `snapshot:${runtimeId}` });
        await mongoose.connection.close();
      } catch (e) {}
    }
  }, 30000);

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await Device.deleteMany({ source_id: runtimeId });
      await SystemMetadata.deleteMany({ _id: `snapshot:${runtimeId}` });
    }
  });

  const makeSnapshot = (revision, devices) => {
    const snapshot = {
      runtime_id: runtimeId,
      runtime_generation: 1,
      snapshot_revision: revision,
      snapshot_complete: true,
      record_count: devices.length,
      devices,
    };
    return {
      ...snapshot,
      checksum: calculateCanonicalChecksum(snapshot),
    };
  };

  test('applies hardware fields while preserving SOC security status', async () => {
    if (mongoose.connection.readyState === 0) return;
    await Device.create({
      _id: 'snapshot-plc-01',
      name: 'Old PLC',
      type: 'controller',
      zone: 'purdue-l1',
      ipAddress: '192.168.50.10',
      macAddress: '00:00:00:00:50:10',
      source_id: runtimeId,
      security_status: 'isolated',
      operational_status: 'active',
      status: 'active',
    });

    const snapshot = makeSnapshot(2, [{
      device_id: 'snapshot-plc-01',
      external_device_id: 'snapshot-plc-01',
      name: 'Updated PLC',
      type: 'controller',
      zone: 'purdue-l1',
      ip_address: '192.168.50.11',
      mac_address: '00:00:00:00:50:11',
      operational_status: 'offline',
    }]);
    expect(await applyHardwareSnapshot(snapshot)).toBe(true);

    const device = await Device.findById('snapshot-plc-01').lean();
    expect(device.name).toBe('Updated PLC');
    expect(device.operational_status).toBe('offline');
    expect(device.security_status).toBe('isolated');
    const marker = await SystemMetadata.findById(`snapshot:${runtimeId}`).lean();
    expect(marker.value.revision).toBe(2);
  });

  test('rejects an invalid checksum without mutating inventory', async () => {
    if (mongoose.connection.readyState === 0) return;
    const snapshot = makeSnapshot(1, [{
      device_id: 'snapshot-sensor-01',
      name: 'Sensor',
      type: 'sensor',
      ip_address: '192.168.50.20',
      mac_address: '00:00:00:00:50:20',
      operational_status: 'active',
    }]);
    snapshot.checksum = '0'.repeat(64);

    expect(await applyHardwareSnapshot(snapshot)).toBe(false);
    expect(await Device.findById('snapshot-sensor-01')).toBeNull();
    expect(await SystemMetadata.findById(`snapshot:${runtimeId}`)).toBeNull();
  });

  test('decommissions only missing devices owned by the same runtime', async () => {
    if (mongoose.connection.readyState === 0) return;
    await Device.create([
      {
        _id: 'snapshot-old-01',
        name: 'Old runtime device',
        ipAddress: '192.168.50.30',
        macAddress: '00:00:00:00:50:30',
        source_id: runtimeId,
        status: 'active',
      },
      {
        _id: 'snapshot-other-01',
        name: 'Other runtime device',
        ipAddress: '192.168.60.30',
        macAddress: '00:00:00:00:60:30',
        source_id: 'other-runtime',
        status: 'active',
      },
    ]);

    expect(await applyHardwareSnapshot(makeSnapshot(1, []))).toBe(true);
    expect((await Device.findById('snapshot-old-01')).status).toBe('decommissioned');
    expect((await Device.findById('snapshot-other-01')).status).toBe('active');
    await Device.deleteOne({ _id: 'snapshot-other-01' });
  });
});
