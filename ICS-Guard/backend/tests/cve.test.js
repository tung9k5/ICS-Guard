import { jest } from '@jest/globals';
import { getDeviceCves } from '../src/controllers/cveController.js';
import cveService from '../src/services/cveService.js';

describe('CVE Controller & Service Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getDeviceCves should return 400 if keyword is missing', async () => {
    await getDeviceCves(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getDeviceCves should retrieve CVEs successfully', async () => {
    req.query.keyword = 'Modbus';
    const mockCves = [{ cve_id: 'CVE-2023-3814', description: 'Modbus vulnerability', severity: 'HIGH', cvss: 7.5 }];
    jest.spyOn(cveService, 'fetchDeviceCves').mockResolvedValue(mockCves);

    await getDeviceCves(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: mockCves
    }));
  });

  test('cveService.fetchDeviceCves should load static data', async () => {
    const results = await cveService.fetchDeviceCves('Modbus');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].cve_id).toBe('CVE-2023-3814');
  });
});
