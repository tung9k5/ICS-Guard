import { jest } from '@jest/globals';
import { createDevice as createDeviceEndpoint } from '../src/controllers/deviceController.js';
import { Device, AuditLog } from '../src/models/index.js';
import { validateDevice } from '../../shared/schemas/deviceSchema.js';
import { validate as uuidValidate } from 'uuid';

describe('Device Controller - Create Device', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        name: 'Sensor 1',
        type: 'sensor',
        zone: 'Zone A',
        ip_address: '192.168.1.10'
      },
      user: { username: 'admin' },
      ip: '127.0.0.1',
      connection: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('should successfully create a new device with UUIDv4', async () => {
    const mockDevice = {
      _id: 'uuid-string',
      name: 'Sensor 1',
      type: 'sensor',
      node_type: 'sensor',
      zone: 'Zone A',
      ipAddress: '192.168.1.10',
      macAddress: '00:00:00:00:00:00',
      parent_id: null,
      icon_path: 'Cpu',
      hardware_model: '',
      firmware_version: '',
      description: '',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    jest.spyOn(Device, 'create').mockResolvedValue(mockDevice);
    jest.spyOn(AuditLog, 'create').mockResolvedValue(true);
    
    await createDeviceEndpoint(req, res);
    
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Device.create).toHaveBeenCalled();
    
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.message).toContain('thành công');
    expect(responseArgs.data).toBeDefined();
  });
});
