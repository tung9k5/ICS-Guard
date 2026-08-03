import { jest } from '@jest/globals';
import { getAllRules, getRuleById, createRule } from '../src/controllers/ruleController.js';
import { Rule } from '../src/models/index.js';

describe('Rule Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { _id: 'admin123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getAllRules should retrieve rules successfully', async () => {
    const mockRules = [
      { _id: 'rule1', rule_name: 'Modbus Anomaly', severity: 'HIGH', is_active: true }
    ];
    jest.spyOn(Rule, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(Rule, 'find').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockRules)
    });

    await getAllRules(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.status).toBe('success');
    expect(responseArgs.data).toEqual(mockRules);
  });

  test('getRuleById should return 404 if rule not found', async () => {
    req.params.id = 'notfound';
    jest.spyOn(Rule, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    });

    await getRuleById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('createRule should fail if rule name already exists', async () => {
    req.body = { rule_name: 'Existing Rule' };
    jest.spyOn(Rule, 'findOne').mockResolvedValue({ _id: 'rule1' });

    await createRule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
