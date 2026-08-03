import { jest } from '@jest/globals';
import {
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  verifyAndCloseIncident,
  containIncidentDevice,
  recoverIncidentDevice,
} from '../src/controllers/incidentController.js';
import { Incident, IncidentTimeline, Device, SimulatorCommand } from '../src/models/index.js';

describe('Incident Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { _id: 'admin123', username: 'admin' },
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:8000')
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getAllIncidents should retrieve incidents successfully', async () => {
    const mockIncidents = [
      { _id: 'inc1', title: 'Brute Force Attack', severity: 'CRITICAL', status: 'open' }
    ];
    jest.spyOn(Incident, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(Incident, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockIncidents)
    });

    await getAllIncidents(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.status).toBe('success');
    expect(responseArgs.data).toEqual(mockIncidents);
  });

  test('getIncidentById should return 404 if incident not found', async () => {
    req.params.id = 'notfound';
    jest.spyOn(Incident, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    });

    await getIncidentById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('createIncident should succeed and create initial timeline entry', async () => {
    req.body = { title: 'Test Incident', description: 'Testing incident creation' };
    const mockIncident = {
      _id: 'inc123',
      title: 'Test Incident',
      description: 'Testing incident creation',
      severity: 'MEDIUM',
      status: 'open'
    };

    jest.spyOn(Incident, 'create').mockResolvedValue(mockIncident);
    jest.spyOn(IncidentTimeline, 'create').mockResolvedValue({});

    await createIncident(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Incident.create).toHaveBeenCalled();
    expect(IncidentTimeline.create).toHaveBeenCalled();
  });

  test('updateIncident should create timeline entry when important fields change', async () => {
    req.params.id = 'inc123';
    req.body = { status: 'investigating', severity: 'HIGH' };
    const mockIncident = {
      _id: 'inc123',
      title: 'Test Incident',
      description: 'Testing incident update',
      severity: 'MEDIUM',
      status: 'open',
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(Incident, 'findById').mockResolvedValue(mockIncident);
    jest.spyOn(IncidentTimeline, 'create').mockResolvedValue({});

    await updateIncident(req, res);

    expect(mockIncident.save).toHaveBeenCalled();
    expect(IncidentTimeline.create).toHaveBeenCalledWith(expect.objectContaining({
      incident_id: 'inc123',
      actor: 'admin',
      action_type: 'status_change',
      metadata: expect.objectContaining({
        changes: expect.arrayContaining([
          'status: open -> investigating',
          'severity: MEDIUM -> HIGH'
        ])
      })
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateIncident cannot bypass verification by setting status to closed', async () => {
    req.params.id = 'inc123';
    req.body = { status: 'closed' };

    await updateIncident(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Incident.findById).not.toHaveBeenCalled();
  });

  test('verifyAndCloseIncident rejects an incomplete operator checklist', async () => {
    req.params.id = 'inc123';
    req.body = { device_id: '507f1f77bcf86cd799439011', verification: { device_operational: true } };
    await verifyAndCloseIncident(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('verifyAndCloseIncident closes only after successful recovery and device verification', async () => {
    req.params.id = '507f1f77bcf86cd799439012';
    req.body = {
      device_id: 'plc-water-01',
      verification: { device_operational: true, traffic_normal: true, resolution_documented: true },
      note: 'PLC stable for 15 minutes after controlled recovery.',
    };
    const incident = {
      _id: req.params.id,
      status: 'investigating',
      alert_ids: [{ device_id: 'plc-water-01' }],
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(Incident, 'findById').mockReturnValue({ populate: jest.fn().mockResolvedValue(incident) });
    jest.spyOn(Device, 'findById').mockResolvedValue({ _id: req.body.device_id, name: 'PLC-01', status: 'active', security_status: 'normal', ipAddress: '10.0.0.5' });
    jest.spyOn(SimulatorCommand, 'findOne')
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ command_id: 'cmd-restore', status: 'succeeded' }) });
    jest.spyOn(IncidentTimeline, 'create').mockResolvedValue({});
    await verifyAndCloseIncident(req, res);
    expect(incident.status).toBe('closed');
    expect(incident.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(SimulatorCommand.findOne).toHaveBeenNthCalledWith(2, expect.objectContaining({
      command_type: 'rollback',
      target_id: 'plc-water-01',
      status: 'succeeded',
      'correlation.incident_id': req.params.id,
    }));
    expect(IncidentTimeline.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ closure_note: req.body.note }),
    }));
  });

  test('verifyAndCloseIncident requires a substantive closure note', async () => {
    req.params.id = 'inc123';
    req.body = {
      device_id: 'plc-linked',
      verification: { device_operational: true, traffic_normal: true, resolution_documented: true },
      note: 'done',
    };

    await verifyAndCloseIncident(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Incident.findById).not.toHaveBeenCalled();
  });

  test('verifyAndCloseIncident rejects a requested device that is not linked to the incident', async () => {
    req.params.id = 'inc123';
    req.body = {
      device_id: 'plc-unrelated',
      verification: { device_operational: true, traffic_normal: true, resolution_documented: true },
      note: 'Verification completed for the affected asset.',
    };
    const incident = { _id: req.params.id, status: 'investigating', alert_ids: [{ device_id: 'plc-linked' }] };
    jest.spyOn(Incident, 'findById').mockReturnValue({ populate: jest.fn().mockResolvedValue(incident) });
    jest.spyOn(Device, 'findById').mockResolvedValue({ _id: 'plc-linked', source_id: 'runtime-01' });

    await verifyAndCloseIncident(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(SimulatorCommand.findOne).not.toHaveBeenCalled();
  });

  test.each([
    ['containment', containIncidentDevice],
    ['recovery', recoverIncidentDevice],
  ])('%s rejects a requested device that is not linked to the incident', async (_label, handler) => {
    req.params.id = 'inc123';
    req.body = { device_id: 'plc-unrelated' };
    const incident = { _id: req.params.id, status: 'open', alert_ids: [{ device_id: 'plc-linked' }] };
    jest.spyOn(Incident, 'findById').mockReturnValue({ populate: jest.fn().mockResolvedValue(incident) });
    jest.spyOn(Device, 'findById').mockResolvedValue({ _id: 'plc-linked', source_id: 'runtime-01' });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('containment rejects an ambiguous legacy source_id instead of choosing a device', async () => {
    req.params.id = 'inc123';
    req.body = {};
    const incident = { _id: req.params.id, status: 'open', alert_ids: [{ device_id: 'hardware-01' }] };
    jest.spyOn(Incident, 'findById').mockReturnValue({ populate: jest.fn().mockResolvedValue(incident) });
    jest.spyOn(Device, 'findById').mockResolvedValue(null);
    jest.spyOn(Device, 'find').mockReturnValue({
      limit: jest.fn().mockResolvedValue([
        { _id: 'plc-01', source_id: 'hardware-01' },
        { _id: 'plc-02', source_id: 'hardware-01' },
      ]),
    });

    await containIncidentDevice(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('matches multiple inventory devices'),
    }));
  });
});
