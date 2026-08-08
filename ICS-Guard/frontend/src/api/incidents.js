import http from '@/api/httpClient';

const incidentsApi = {
  getAll(params = {}, options = {}) {
    return http({
      url: '/incidents',
      method: 'GET',
      params,
      ...options
    });
  },

  getById(id, options = {}) {
    return http({
      url: `/incidents/${id}`,
      method: 'GET',
      ...options
    });
  },

  createIncident(data, options = {}) {
    return http({
      url: '/incidents',
      method: 'POST',
      data,
      ...options
    });
  },

  update(id, data, options = {}) {
    return http({
      url: `/incidents/${id}`,
      method: 'PUT',
      data,
      ...options
    });
  },

  delete(id, options = {}) {
    return http({
      url: `/incidents/${id}`,
      method: 'DELETE',
      ...options
    });
  },

  deleteMultiple(ids, options = {}) {
    return http({
      url: '/incidents/bulk-delete',
      method: 'POST',
      data: { ids },
      ...options
    });
  },

  triggerAiAnalysis(id, options = {}) {
    return http({
      url: `/incidents/${id}/ai-analyze`,
      method: 'POST',
      ...options
    });
  },

  contain(id, data = {}, options = {}) {
    return http({
      url: `/incidents/${id}/containment`,
      method: 'POST',
      data,
      ...options
    });
  },

  verifyAndClose(id, data, options = {}) {
    return http({
      url: `/incidents/${id}/verify-close`,
      method: 'POST',
      data,
      ...options
    });
  },

  recover(id, data = {}, options = {}) {
    return http({
      url: `/incidents/${id}/recovery`,
      method: 'POST',
      data,
      ...options
    });
  },

  getAttackGraph(id, options = {}) {
    return http({
      url: `/incidents/${id}/attack-graph`,
      method: 'GET',
      ...options
    });
  },

  executePlaybookStep(id, data = {}, options = {}) {
    return http({
      url: `/incidents/${id}/playbook/step`,
      method: 'POST',
      data,
      ...options
    });
  },

  getForensics(id, options = {}) {
    return http({
      url: `/incidents/${id}/forensics`,
      method: 'GET',
      ...options
    });
  },

  exportPdfReport(id, options = {}) {
    return http({
      url: `/incidents/${id}/export-pdf`,
      method: 'GET',
      ...options
    });
  },

  addForensicsArtifact(id, data, options = {}) {
    return http({
      url: `/incidents/${id}/forensics`,
      method: 'POST',
      data,
      ...options
    });
  },

  acceptIncident(id, options = {}) {
    return http({
      url: `/incidents/${id}/accept`,
      method: 'POST',
      ...options
    });
  },

  markFullySafe(id, data = {}, options = {}) {
    return http({
      url: `/incidents/${id}/mark-safe`,
      method: 'POST',
      data,
      ...options
    });
  },

  deleteForensicsArtifact(id, artifactId, options = {}) {
    return http({
      url: `/incidents/${id}/forensics/${artifactId}`,
      method: 'DELETE',
      ...options
    });
  }
};

export default incidentsApi;
