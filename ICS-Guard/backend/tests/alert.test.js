import { jest } from '@jest/globals';
import { getAllAlerts, getAlertById, updateAlertStatus } from '../src/controllers/alertController.js';
import { Alert } from '../src/models/index.js';

describe('Alert Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { username: 'admin' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getAllAlerts should retrieve alerts successfully', async () => {
    const mockAlerts = [
      { _id: 'alert1', title: 'High Temp Alert', severity: 'HIGH', status: 'new' }
    ];
    jest.spyOn(Alert, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(Alert, 'find').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockAlerts)
    });

    await getAllAlerts(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.status).toBe('success');
    expect(responseArgs.data).toEqual(mockAlerts);
  });

  test('getAlertById should return 404 if alert not found', async () => {
    req.params.id = 'notfound';
    jest.spyOn(Alert, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    });

    await getAlertById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateAlertStatus should fail on invalid status', async () => {
    req.body = { status: 'invalid_status' };

    await updateAlertStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updateAlertStatus should clear resolved fields when alert is reopened', async () => {
    req.params.id = 'alert1';
    req.body = { status: 'acknowledged' };
    const mockAlert = { _id: 'alert1', status: 'acknowledged', resolved_at: null, resolved_by: null };
    jest.spyOn(Alert, 'findByIdAndUpdate').mockResolvedValue(mockAlert);

    await updateAlertStatus(req, res);

    expect(Alert.findByIdAndUpdate).toHaveBeenCalledWith(
      'alert1',
      {
        $set: {
          status: 'acknowledged',
          resolved_at: null,
          resolved_by: null
        }
      },
      { new: true, runValidators: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
