import { jest } from '@jest/globals';
import { getPlaybooks, createPlaybook } from '../src/controllers/playbookController.js';
import { Playbook } from '../src/models/index.js';

describe('Playbook Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: 'admin123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getPlaybooks should return all playbooks', async () => {
    const mockPlaybooks = [{ _id: 'pb1', name: 'Mitigate DDoS' }];
    jest.spyOn(Playbook, 'find').mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockPlaybooks)
    });

    await getPlaybooks(req, res);

    expect(res.json).toHaveBeenCalledWith(mockPlaybooks);
  });

  test('createPlaybook should create a new playbook', async () => {
    req.body = { name: 'Block SSH Port', action: 'firewall_block' };
    const mockSave = jest.fn().mockResolvedValue(true);
    
    // Spy on Playbook constructor instance save
    jest.spyOn(Playbook.prototype, 'save').mockImplementation(mockSave);

    await createPlaybook(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockSave).toHaveBeenCalled();
  });
});
