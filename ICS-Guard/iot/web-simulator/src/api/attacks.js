import { attackApi } from '@/http/clients/trustEdges';

export default {
  // GET /api/attacks/devices — returns all devices from backend
  async getDevices(params = {}, options = {}) {
    try {
      const res = await attackApi({
        url: '/attacks/devices',
        method: 'GET',
        params: { per_page: 1000, ...params },
        ...options
      });
      // backend returns { data: [...], pagination: {...} }
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    } catch (e) {
      console.warn('[attacks.js] /attacks/devices failed, fallback to /devices:', e.message);
      // Fallback: get all devices from /api/devices
      try {
        const res2 = await attackApi({
          url: '/devices',
          method: 'GET',
          params: { per_page: 1000, ...params },
          ...options
        });
        if (Array.isArray(res2)) return res2;
        if (Array.isArray(res2?.data)) return res2.data;
      } catch (e2) {
        console.error('[attacks.js] Both fallback calls failed:', e2.message);
      }
      return [];
    }
  },

  // POST /api/attacks/launch — launch attack on a device
  launchAttack(deviceId, attackType, options = {}) {
    return attackApi({
      url: '/attacks/launch',
      method: 'POST',
      data: {
        device_id: deviceId,
        attack_type: attackType,
      },
      ...options
    });
  },

  getRun(runId, options = {}) {
    return attackApi({
      url: `/attacks/runs/${runId}`,
      method: 'GET',
      ...options
    });
  },

  stopRun(runId, options = {}) {
    return attackApi({
      url: `/attacks/runs/${runId}/stop`,
      method: 'POST',
      data: {},
      ...options
    });
  },

  killSwitch(options = {}) {
    return attackApi({
      url: '/attacks/kill-switch',
      method: 'POST',
      data: {},
      ...options
    });
  },

  deleteDevice() {
    return Promise.reject(new Error('Attack targets are runtime-owned and cannot be deleted here'));
  },

  bulkDeleteDevices() {
    return Promise.reject(new Error('Attack targets are runtime-owned and cannot be deleted here'));
  }
};
