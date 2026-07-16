import { IncidentTimeline } from '../models/index.js';

class IncidentTimelineRepository {
  async findByIncidentId(incidentId) {
    return IncidentTimeline.find({ incident_id: incidentId }).sort({ event_time: 1 });
  }

  async create(data) {
    return IncidentTimeline.create(data);
  }

  async deleteByIncidentId(incidentId) {
    return IncidentTimeline.deleteMany({ incident_id: incidentId });
  }

  async deleteByIncidentIds(ids) {
    return IncidentTimeline.deleteMany({ incident_id: { $in: ids } });
  }
}

export default new IncidentTimelineRepository();
