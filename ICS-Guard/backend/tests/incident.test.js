import { jest } from '@jest/globals';
import { getAllIncidents, getIncidentById, createIncident, updateIncident } from '../src/controllers/incidentController.js';
import { Incident, IncidentTimeline } from '../src/models/index.js';

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
});
