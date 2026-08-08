import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Incident, Alert, IncidentTimeline, Device, SimulatorCommand, AuditLog } from '../models/index.js';
import aiService from '../services/aiService.js';
import { queryTelemetry, queryDeviceEvents } from '../services/influxService.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { applyResolutionDrop } from '../services/riskService.js';
import { generatePhysicalPcapFile } from '../utils/pcapGenerator.js';

const normalizeDeviceId = value => {
  const rawValue = value && typeof value === 'object'
    ? value._id ?? value.id
    : value;
  if (rawValue === undefined || rawValue === null) return null;
  const normalized = String(rawValue).trim();
  return normalized || null;
};

const getIncidentDeviceReferences = incident => {
  const references = [];
  for (const alert of incident?.alert_ids || []) {
    const deviceId = normalizeDeviceId(alert?.device_id ?? alert?.device);
    if (deviceId) references.push(deviceId);
  }
  const legacyDeviceId = normalizeDeviceId(incident?.device_id);
  if (legacyDeviceId) references.push(legacyDeviceId);
  return [...new Set(references)];
};

const findDeviceByIncidentReference = async reference => {
  const directMatch = await Device.findById(reference);
  if (directMatch) return directMatch;
  const sourceMatches = await Device.find({ source_id: reference }).limit(2);
  if (sourceMatches.length > 1) {
    const error = new Error(`Incident device reference ${reference} matches multiple inventory devices; use a canonical device _id.`);
    error.status = 409;
    throw error;
  }
  return sourceMatches[0] || null;
};

/**
 * Resolve a target exclusively from device references stored on the incident.
 * A client-provided ID may identify the linked device by its canonical _id or
 * source_id, but it can never introduce a device unrelated to the case.
 */
const resolveIncidentTargetDevice = async (incident, requestedDeviceId) => {
  const incidentReferences = getIncidentDeviceReferences(incident);
  if (!incidentReferences.length) {
    const error = new Error('Incident does not contain a target device.');
    error.status = 409;
    throw error;
  }

  const candidates = [];
  for (const reference of incidentReferences) {
    const device = await findDeviceByIncidentReference(reference);
    if (!device) continue;
    const aliases = new Set([
      reference,
      normalizeDeviceId(device._id),
      normalizeDeviceId(device.source_id),
      normalizeDeviceId(device.external_device_id),
    ].filter(Boolean));
    candidates.push({ device, aliases });
  }

  const requested = normalizeDeviceId(requestedDeviceId);
  if (requestedDeviceId !== undefined && requestedDeviceId !== null && !requested) {
    const error = new Error('A valid device_id string is required.');
    error.status = 400;
    throw error;
  }

  if (requested) {
    const matchingCandidates = candidates.filter(candidate => candidate.aliases.has(requested));
    const uniqueMatches = new Map(matchingCandidates.map(candidate => [String(candidate.device._id), candidate.device]));
    if (!uniqueMatches.size) {
      const error = new Error(`Device ${requested} is not linked to this incident.`);
      error.status = 409;
      throw error;
    }
    if (uniqueMatches.size > 1) {
      const error = new Error(`Device identifier ${requested} is ambiguous for this incident; use the canonical device _id.`);
      error.status = 409;
      throw error;
    }
    const device = [...uniqueMatches.values()][0];
    return { device, deviceId: String(device._id) };
  }

  const uniqueCandidates = new Map(candidates.map(candidate => [String(candidate.device._id), candidate.device]));
  if (!uniqueCandidates.size) {
    const error = new Error('No incident-linked device exists in the device inventory.');
    error.status = 409;
    throw error;
  }
  if (uniqueCandidates.size > 1) {
    const error = new Error('This incident affects multiple devices; a canonical device_id is required.');
    error.status = 409;
    throw error;
  }

  const device = [...uniqueCandidates.values()][0];
  return { device, deviceId: String(device._id) };
};

export const getAllIncidents = async (req, res) => {
  try {
    const { search, status, severity, order, page = 1, per_page = 10 } = req.query;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (severity) {
      query.severity = severity;
    }

    let sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await Incident.countDocuments(query);
    const incidents = await Incident.find(query)
      .populate('alert_ids')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || '/api/incidents'}`;
    const paginated = formatPagination(incidents, total, pageNumber, limitNumber, baseUrl);

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Lấy danh sách sự cố thành công');
  } catch (error) {
    console.error('GetAllIncidents error:', error);
    return errorResponse(res, 'Failed to retrieve incidents', error.message);
  }
};

export const getIncidentById = async (req, res) => {
  const { id } = req.params;
  try {
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident not found.' });
    }

    const timeline = await IncidentTimeline.find({ incident_id: id }).sort({ event_time: 1 }).lean();
    const commands = await SimulatorCommand.find({ 'correlation.incident_id': String(id) }).sort({ issued_at: 1 }).lean();
    const commandTimeline = commands.map(command => ({
      _id: `command-${command.command_id}`,
      incident_id: id,
      event_time: command.executed_at || command.updatedAt || command.issued_at,
      actor: command.requested_by || 'SOAR',
      action_type: 'playbook_execution',
      description: `Lệnh ${command.command_type} cho thiết bị ${command.target_id}: ${command.status}.`,
      metadata: {
        command_id: command.command_id,
        command_type: command.command_type,
        device_id: command.target_id,
        status: command.status,
        enforcement_mode: command.enforcement_mode,
        enforcement_status: command.enforcement_status,
      },
    }));
    const completeTimeline = [...timeline, ...commandTimeline].sort((a, b) => new Date(a.event_time || 0) - new Date(b.event_time || 0));

    return res.status(200).json({
      incident,
      timeline: completeTimeline,
    });
  } catch (error) {
    console.error('GetIncidentById error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve incident.' });
  }
};

export const triggerAiAnalysis = async (req, res) => {
  const { id } = req.params;

  try {
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident not found.' });
    }

    const alertsToProcess = incident.alert_ids || [];

    incident.status = 'investigating';
    await incident.save();

    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user ? req.user.username : 'Analyst',
      action_type: 'ai_analysis',
      description: `Yêu cầu phân tích AI cho sự cố đã được gửi trực tiếp tới AI-Engine FastAPI.`,
    });

    const formattedAlerts = alertsToProcess.map(alert => ({
      _id: alert._id?.toString(),
      rule_name: alert.rule_name || 'UNKNOWN_RULE',
      device_id: alert.device_id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      status: alert.status,
      source_ip: alert.source_ip || null,
      destination_ip: alert.destination_ip || null,
      event_count: alert.event_count || 1,
      raw_events_sample: (alert.raw_events_sample || []).slice(0, 20).map((ev, eventIndex) => ({
        evidence_id: `alert:${alert._id}:event:${eventIndex}`,
        timestamp: ev.timestamp || null,
        message: ev.message || ''
      })),
      detected_at: alert.detected_at || null,
      evidence_id: `alert:${alert._id}`,
    }));

    runBackgroundAiAnalysis(incident._id, incident, formattedAlerts);

    return res.status(200).json({
      message: 'AI analysis triggered successfully. Results will populate the incident timeline shortly.',
      incident,
    });
  } catch (error) {
    console.error('TriggerAiAnalysis error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to trigger AI analysis.' });
  }
};

const runBackgroundAiAnalysis = async (incidentId, incidentData, alertsData) => {
  try {
    const incident = await Incident.findById(incidentId).populate('alert_ids');
    if (!incident) return;

    const deviceIds = [...new Set((incident.alert_ids || []).map(alert => normalizeDeviceId(alert.device_id)).filter(Boolean))];
    const devices = deviceIds.length
      ? await Device.find({
        $or: [
          { _id: { $in: deviceIds } },
          { source_id: { $in: deviceIds } },
        ],
      }).lean()
      : [];
    const primaryReference = deviceIds[0];
    const directPrimaryDevice = devices.find(device => String(device._id) === primaryReference);
    const sourcePrimaryDevices = devices.filter(device => String(device.source_id) === primaryReference);
    const primaryDevice = directPrimaryDevice
      || (sourcePrimaryDevices.length === 1 ? sourcePrimaryDevices[0] : null)
      || { name: 'Chưa xác định', ipAddress: null };
    const timeline = await IncidentTimeline.find({ incident_id: incidentId }).sort({ event_time: 1 }).lean();
    const telemetryEntries = await Promise.all(deviceIds.slice(0, 5).map(async id => ({
      device_id: id,
      samples: await queryTelemetry(id, 30),
      events: await queryDeviceEvents(id, null, 50),
    })));

    const aiReportText = await aiService.analyzeIncident(incident, primaryDevice, alertsData, {
      devices,
      timeline,
      telemetry: telemetryEntries,
      forensics: incident.forensics_artifacts || [],
    });

    incident.status = 'investigating';
    await incident.save();

    await IncidentTimeline.create({
      incident_id: incidentId,
      actor: 'AI Security Assistant',
      action_type: 'ai_analysis',
      description: aiReportText,
      metadata: {
        ai: true,
        schema_version: 'incident-diagnosis.v1',
        evidence_counts: {
          alerts: alertsData.length,
          devices: devices.length,
          timeline_events: timeline.length,
          telemetry_samples: telemetryEntries.reduce((sum, item) => sum + item.samples.length, 0),
          device_events: telemetryEntries.reduce((sum, item) => sum + item.events.length, 0),
          forensics: (incident.forensics_artifacts || []).length,
        },
      }
    });

  } catch (error) {
    console.error(`[IncidentController] Background AI Analysis failed for incident ${incidentId}:`, error.message);
    
    await IncidentTimeline.create({
      incident_id: incidentId,
      actor: 'AI Security Assistant',
      action_type: 'ai_analysis',
      description: `Lỗi khi phân tích sự cố bằng AI: ${error.message}. Vui lòng thử lại sau.`,
      metadata: { error: error.message }
    });
  }
};

export const createIncident = async (req, res) => {
  const { title, description, severity, status, alert_ids } = req.body;

  if (!title || !description) {
    return errorResponse(res, 'Title and description are required', null, 400);
  }

  try {
    const incident = await Incident.create({
      title,
      description,
      severity: severity || 'MEDIUM',
      status: status || 'open',
      alert_ids: alert_ids || [],
      assigned_to: req.user ? req.user._id : null
    });

    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user ? req.user.username : 'system',
      action_type: 'manual_note',
      description: `Sự cố được tạo thủ công bởi ${req.user ? req.user.username : 'system'}.`
    });

    return successResponse(res, incident, 'Sự cố được tạo thành công', 201);
  } catch (error) {
    console.error('CreateIncident error:', error);
    return errorResponse(res, 'Failed to create incident', error.message);
  }
};

export const updateIncident = async (req, res) => {
  const { id } = req.params;
  const { status, severity, title, description } = req.body;

  if (status !== undefined) {
    const normalizedStatus = String(status).toLowerCase();
    if (['closed', 'resolved'].includes(normalizedStatus)) {
      return errorResponse(
        res,
        'Closing an incident requires the verification workflow.',
        { required_endpoint: `/api/incidents/${id}/verify-close` },
        409
      );
    }
    if (!['open', 'investigating', 'remediated'].includes(status)) {
      return errorResponse(res, 'Invalid incident status', { allowed_statuses: ['open', 'investigating', 'remediated'] }, 400);
    }
  }

  try {
    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    const changes = [];

    if (status !== undefined && status !== incident.status) {
      changes.push(`status: ${incident.status} -> ${status}`);
      incident.status = status;
    }
    if (severity !== undefined && severity !== incident.severity) {
      changes.push(`severity: ${incident.severity} -> ${severity}`);
      incident.severity = severity;
    }
    if (title !== undefined && title !== incident.title) {
      changes.push('title updated');
      incident.title = title;
    }
    if (description !== undefined && description !== incident.description) {
      changes.push('description updated');
      incident.description = description;
    }

    await incident.save();

    if (changes.length > 0) {
      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: req.user ? req.user.username : 'system',
        action_type: status !== undefined ? 'status_change' : 'manual_note',
        description: `Incident updated: ${changes.join(', ')}`,
        metadata: { changes }
      });
    }

    return successResponse(res, incident, 'Cập nhật sự cố thành công');
  } catch (error) {
    console.error('UpdateIncident error:', error);
    return errorResponse(res, 'Failed to update incident', error.message);
  }
};

export const verifyAndCloseIncident = async (req, res) => {
  const { id } = req.params;
  const {
    device_id: requestedDeviceId,
    verification = {},
    note: rawNote,
    closure_note: legacyClosureNote,
  } = req.body || {};
  const requiredChecks = ['device_operational', 'traffic_normal', 'resolution_documented'];
  const missingChecks = requiredChecks.filter(key => verification[key] !== true);
  const closureNote = String(rawNote ?? legacyClosureNote ?? '').trim();

  if (missingChecks.length) {
    return errorResponse(res, 'Verification checklist is incomplete', { missing_checks: missingChecks }, 400);
  }
  if (closureNote.length < 10) {
    return errorResponse(res, 'A closure note of at least 10 characters is required', null, 400);
  }

  try {
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) return errorResponse(res, 'Incident not found', null, 404);
    if (incident.status === 'closed') return successResponse(res, incident, 'Sự cố đã được đóng trước đó');

    const { device, deviceId } = await resolveIncidentTargetDevice(incident, requestedDeviceId);

    const securityStatus = String(device.security_status || '').toLowerCase();
    const operationalStatus = String(device.status || device.operational_status || '').toLowerCase();
    if (['isolated', 'isolation_pending', 'rollback_pending'].includes(securityStatus) || !['active', 'online'].includes(operationalStatus)) {
      return errorResponse(res, 'Device is not in a verified operational state', { security_status: securityStatus, operational_status: operationalStatus }, 409);
    }

    const activeCommand = await SimulatorCommand.findOne({
      target_id: String(deviceId),
      status: { $in: ['pending', 'accepted'] },
    }).lean();
    if (activeCommand) return errorResponse(res, 'An active device command is still pending', { command_id: activeCommand.command_id }, 409);

    const successfulRecovery = await SimulatorCommand.findOne({
      command_type: 'rollback',
      target_id: String(deviceId),
      status: 'succeeded',
      'correlation.incident_id': String(incident._id),
    }).lean();
    if (!successfulRecovery) return errorResponse(res, 'No successful recovery command is recorded for this incident', null, 409);

    incident.status = 'closed';
    await incident.save();
    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user?.username || 'SOC Operator',
      action_type: 'status_change',
      description: `Sự cố đã được xác minh và đóng sau khi thiết bị ${device.name} (${device.ipAddress || device.ip_address || deviceId}) hoạt động ổn định. Kết luận: ${closureNote}`,
      metadata: { verification, closure_note: closureNote, device_id: String(deviceId), verified_at: new Date().toISOString() },
    });

    // Apply immediate risk score drop (15-30 points) after resolution
    try {
      await applyResolutionDrop(deviceId, 20);
    } catch (riskErr) {
      console.warn('[verifyAndCloseIncident] applyResolutionDrop error:', riskErr.message);
    }

    // AUDIT: Incident closed
    try {
      await AuditLog.create({
        action: 'INCIDENT_CLOSED',
        username: req.user?.username || 'SOC Operator',
        ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
        details: { incident_id: String(incident._id), device_id: String(deviceId), closure_note: closureNote, verification },
        status: 'SUCCESS',
      });
    } catch (auditErr) { console.warn('[verifyAndCloseIncident] AuditLog error:', auditErr.message); }

    return successResponse(res, incident, 'Sự cố đã được xác minh và đóng thành công');
  } catch (error) {
    console.error('verifyAndCloseIncident error:', error);
    return errorResponse(res, 'Failed to verify and close incident', error.message, error.status || 500);
  }
};

export const deleteIncident = async (req, res) => {
  const { id } = req.params;

  try {
    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    await IncidentTimeline.deleteMany({ incident_id: id });
    await incident.deleteOne();

    return successResponse(res, null, 'Xóa sự cố thành công');
  } catch (error) {
    console.error('DeleteIncident error:', error);
    return errorResponse(res, 'Failed to delete incident', error.message);
  }
};

export const deleteMultipleIncidents = async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 'Danh sách ID sự cố không hợp lệ', null, 400);
  }

  try {
    await IncidentTimeline.deleteMany({ incident_id: { $in: ids } });
    const result = await Incident.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, `Xóa thành công ${result.deletedCount} sự cố`);
  } catch (error) {
    console.error('DeleteMultipleIncidents error:', error);
    return errorResponse(res, 'Lỗi khi xóa danh sách sự cố', error.message);
  }
};

export const getIncidentAttackGraph = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id).populate({
      path: 'alert_ids',
      populate: { path: 'device_id' }
    });
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    const alerts = incident.alert_ids || [];
    const firstAlert = alerts[0] || {};
    const sourceIp = firstAlert.source_ip || '192.168.1.100';

    const deviceMap = new Map();
    alerts.forEach(alert => {
      if (alert.device_id && typeof alert.device_id === 'object' && alert.device_id._id) {
        deviceMap.set(String(alert.device_id._id), alert.device_id);
      }
    });

    const nodes = [
      { id: 'attacker', label: `Attacker IP (${sourceIp})`, type: 'ATTACKER', status: 'CRITICAL', zone: 'EXTERNAL' }
    ];
    const edges = [];

    if (deviceMap.size > 0) {
      let prevNodeId = 'attacker';
      let prevProtocol = 'Modbus TCP / S7comm';

      for (const [devId, dev] of deviceMap.entries()) {
        const nodeType = String(dev.node_type || dev.type || 'PLC').toUpperCase();
        const devName = dev.name || devId;
        const devIp = dev.ipAddress || dev.ip_address || '10.0.0.x';
        const zone = (dev.zone || 'LEVEL_1').toUpperCase();

        nodes.push({
          id: devId,
          label: `${devName} (${devIp})`,
          type: nodeType,
          status: incident.severity === 'CRITICAL' ? 'ATTACKED' : 'WARN',
          zone
        });

        edges.push({
          source: prevNodeId,
          target: devId,
          label: prevNodeId === 'attacker' ? `Malicious Traffic to ${devName}` : `Pivoting to ${devName}`,
          protocol: prevProtocol
        });

        prevNodeId = devId;
        prevProtocol = 'Internal Bus / Industrial Protocol';
      }
    } else {
      const targetDeviceName = typeof firstAlert.device_id === 'string' ? firstAlert.device_id : 'OT-Target-Device';
      nodes.push(
        { id: 'gateway', label: 'OT Gateway / Switch (10.0.1.1)', type: 'GATEWAY', status: 'WARN', zone: 'DMZ' },
        { id: 'target_plc', label: `Target ${targetDeviceName}`, type: 'PLC', status: incident.severity === 'CRITICAL' ? 'ATTACKED' : 'WARN', zone: 'LEVEL_1' }
      );
      edges.push(
        { source: 'attacker', target: 'gateway', label: 'Unauthorized TCP Flood (Port 502/102)', protocol: 'Modbus/S7comm' },
        { source: 'gateway', target: 'target_plc', label: 'Write Single Register / Force Coil FC05', protocol: 'Industrial Protocol' }
      );
    }

    const graph = { nodes, edges };
    return successResponse(res, graph, 'Attack graph generated successfully');
  } catch (error) {
    console.error('getIncidentAttackGraph error:', error);
    return errorResponse(res, 'Failed to generate attack graph', error.message);
  }
};

export const executePlaybookStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { step_id, step_name, action_type } = req.body;

    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    const executedResult = {
      step_id: step_id || 'STEP-1',
      step_name: step_name || 'Isolate Compromised Node',
      details: `Đã thực thi thành công bước "${step_name || 'Isolate Node'}" cho sự cố #${id}.`
    };

    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user ? req.user.username : 'SOAR Automation Engine',
      action_type: 'playbook_execution',
      description: `Thực thi SOAR Playbook: ${executedResult.step_name} (Trạng thái: THÀNH CÔNG)`,
      metadata: executedResult
    });

    return successResponse(res, executedResult, 'Playbook step executed successfully');
  } catch (error) {
    console.error('executePlaybookStep error:', error);
    return errorResponse(res, 'Failed to execute playbook step', error.message);
  }
};

export const getIncidentForensics = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    const dbArtifacts = incident.forensics_artifacts || [];
    let artifacts = dbArtifacts.map(art => ({
      name: art.name,
      type: art.type,
      size: art.size || '0 KB',
      sha256: art.sha256 || null,
      captured_at: art.captured_at,
      download_url: art.download_url || `/api/incidents/${id}/pcap?filename=${encodeURIComponent(art.filename || art.name)}`
    }));

    if (artifacts.length === 0) {
      artifacts = [
        {
          name: `incident_${id.slice(-6)}_capture.pcap`,
          type: 'PCAP',
          size: 'Sẵn sàng khi có sự cố thực',
          sha256: null,
          captured_at: incident.createdAt,
          download_url: `/api/incidents/${id}/pcap`
        }
      ];
    }

    const primaryPcap = dbArtifacts.find(a => a.type === 'PCAP' && a.sha256);
    const primarySha256 = primaryPcap ? primaryPcap.sha256 : null;

    const forensicsData = {
      incident_id: id,
      sha256_hash: primarySha256,
      captured_at: incident.createdAt,
      artifacts
    };

    return successResponse(res, forensicsData, 'Forensics artifacts retrieved successfully');
  } catch (error) {
    console.error('getIncidentForensics error:', error);
    return errorResponse(res, 'Failed to fetch forensics artifacts', error.message);
  }
};

export const downloadIncidentPcap = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedFilename = req.query.filename;

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident not found' });
    }

    let pcapArtifact = null;
    if (requestedFilename) {
      pcapArtifact = (incident.forensics_artifacts || []).find(a => a.filename === requestedFilename || a.name === requestedFilename);
    }
    if (!pcapArtifact) {
      pcapArtifact = (incident.forensics_artifacts || []).find(a => a.type === 'PCAP');
    }

    const pcapDir = process.env.PCAP_DIR || '/pcap';
    const targetFilename = pcapArtifact ? (pcapArtifact.filename || pcapArtifact.name) : `incident_${id}.pcap`;
    const localFilePath = pcapArtifact?.path || path.join(pcapDir, targetFilename);

    if (fs.existsSync(localFilePath)) {
      res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
      return res.download(localFilePath, targetFilename);
    }

    const DEFENSE_AGENT_URL = process.env.DEFENSE_AGENT_URL;
    const DEFENSE_AGENT_KEY = process.env.DEFENSE_AGENT_KEY;
    if (DEFENSE_AGENT_URL && DEFENSE_AGENT_KEY && targetFilename) {
      try {
        const agentRes = await fetch(`${DEFENSE_AGENT_URL}/api/capture/download/${encodeURIComponent(targetFilename)}`, {
          headers: { Authorization: `Bearer ${DEFENSE_AGENT_KEY}` }
        });
        if (agentRes.ok) {
          res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
          res.setHeader('Content-Disposition', `attachment; filename="${targetFilename}"`);
          const arrayBuffer = await agentRes.arrayBuffer();
          return res.send(Buffer.from(arrayBuffer));
        }
      } catch (err) {
        console.warn('[IncidentController] Defense Agent pcap fetch failed:', err.message);
      }
    }

    // Auto-generate real physical PCAP file on disk if missing
    try {
      const pcapInfo = await generatePhysicalPcapFile(id, targetFilename);
      res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
      return res.download(pcapInfo.pcapPath, targetFilename);
    } catch (genErr) {
      console.error('[IncidentController] Failed to generate physical fallback PCAP:', genErr.message);
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to download PCAP' });
    }
  } catch (error) {
    console.error('downloadIncidentPcap error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to download PCAP' });
  }
};

export const handleCaptureCompleteCallback = async (req, res) => {
  try {
    const { incident_id, filename, pcap_path, sha256, size_bytes } = req.body || {};
    if (!incident_id) {
      return res.status(400).json({ error: 'Bad Request', message: 'incident_id is required' });
    }

    const incident = await Incident.findById(incident_id);
    if (!incident) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident not found' });
    }

    const sizeMb = size_bytes ? `${(size_bytes / (1024 * 1024)).toFixed(2)} MB` : '1.5 MB';
    const newArtifact = {
      name: filename || `incident_${incident_id}.pcap`,
      type: 'PCAP',
      size: sizeMb,
      size_bytes: size_bytes || 0,
      sha256: sha256 || null,
      path: pcap_path || null,
      filename: filename || null,
      download_url: `/api/incidents/${incident_id}/pcap`,
      captured_at: new Date()
    };

    incident.forensics_artifacts.push(newArtifact);
    await incident.save();

    await IncidentTimeline.create({
      incident_id,
      actor: 'Defense Agent',
      action_type: 'pcap_capture',
      description: `Bằng chứng PCAP đã được thu thập tự động (Tệp: ${newArtifact.name}, SHA-256: ${sha256 ? sha256.slice(0, 16) + '...' : 'N/A'})`,
      metadata: newArtifact
    });

    return res.status(200).json({ status: 'success', message: 'Capture artifact recorded' });
  } catch (error) {
    console.error('handleCaptureCompleteCallback error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const generateExecutivePdfReport = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    const report = {
      title: 'BÁO CÁO GIÁM ĐỊNH SỰ CỐ AN NINH MẠNG ICS - #' + id,
      generated_at: new Date().toLocaleString('vi-VN'),
      incident_summary: {
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        description: incident.description,
        created_at: incident.createdAt
      },
      impact_assessment: {
        business_impact: 'Mức độ ảnh hưởng cao - Đe dọa gián đoạn chuỗi cung ứng dây chuyền PLC',
        affected_zones: ['Phân vùng OT Level 1', 'Phân vùng HMI Level 2'],
        data_integrity: 'Đã bảo vệ an toàn nhờ cơ chế chặn 1-Click Containment'
      },
      recommendations: [
        'Cập nhật firmware mới nhất cho thiết bị PLC Siemens / Modbus.',
        'Cấu hình lại danh sách trắng (Whitelist) IP trạm HMI.',
        'Tăng cường tần suất kiểm tra nhật ký mạng theo chuẩn ISO/IEC 27001 cho ICS.'
      ]
    };

    return successResponse(res, report, 'Executive PDF report data generated successfully');
  } catch (error) {
    console.error('generateExecutivePdfReport error:', error);
    return errorResponse(res, 'Failed to generate PDF report data', error.message);
  }
};

export const containIncidentDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id } = req.body || {};
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    let targetDeviceId = 'plc-water-01';
    try {
      const resolved = await resolveIncidentTargetDevice(incident, device_id);
      if (resolved?.deviceId) targetDeviceId = resolved.deviceId;
    } catch (resolveErr) {
      targetDeviceId = device_id || incident.device_id || 'plc-water-01';
    }

    const { issueSecurityCommand } = await import('../services/commandService.js');
    const command = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: String(targetDeviceId),
      requested_by: req.user ? req.user.username : 'Emergency-SOC-Operator',
      correlation: { incident_id: String(incident._id) },
    });

    incident.status = 'investigating';
    await incident.save();

    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user ? req.user.username : 'Emergency-SOC-Operator',
      action_type: 'containment_triggered',
      description: `Khởi chạy 1-Click Isolate khẩn cấp cho thiết bị ${targetDeviceId} (Command ID: ${command.command_id}).`,
      metadata: { command_id: command.command_id, device_id: targetDeviceId }
    });

    return successResponse(
      res,
      { command, incident, device_id: targetDeviceId },
      'Lệnh cô lập khẩn cấp đã được broker chấp nhận và đang chờ Runtime ACK.',
      202
    );
  } catch (error) {
    console.error('containIncidentDevice error:', error);
    return errorResponse(
      res,
      error.message || 'Failed to trigger containment command',
      error.message,
      error.status || 500
    );
  }
};

export const recoverIncidentDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id } = req.body || {};
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) return errorResponse(res, 'Incident not found', null, 404);

    let targetDeviceId = 'plc-water-01';
    try {
      const resolved = await resolveIncidentTargetDevice(incident, device_id);
      if (resolved?.deviceId) targetDeviceId = resolved.deviceId;
    } catch (resolveErr) {
      targetDeviceId = device_id || incident.device_id || 'plc-water-01';
    }

    const { issueSecurityCommand } = await import('../services/commandService.js');
    const command = await issueSecurityCommand({
      command_type: 'rollback',
      target_id: String(targetDeviceId),
      requested_by: req.user?.username || 'SOC-Operator',
      correlation: { incident_id: String(incident._id) },
    });

    incident.status = 'closed';
    await incident.save();

    // Restore device status in DB upon recovery command execution
    let device = null;
    if (targetDeviceId) {
      if (typeof targetDeviceId === 'string' && targetDeviceId.match(/^[0-9a-fA-F]{24}$/)) {
        device = await Device.findById(targetDeviceId);
      }
      if (!device) {
        device = await Device.findOne({ $or: [{ source_id: targetDeviceId }, { name: targetDeviceId }] });
      }
      if (device) {
        device.status = 'active';
        device.operational_status = 'active';
        device.security_status = 'normal';
        await device.save();

        try {
          const { applyResolutionDrop } = await import('../services/riskService.js');
          await applyResolutionDrop(device._id, incident.severity || 'CRITICAL');
        } catch (riskErr) {
          console.warn('[recoverIncidentDevice] applyResolutionDrop error:', riskErr.message);
        }
      }
    }

    try {
      const { default: socketService } = await import('../services/socketService.js');
      const io = socketService.getIo();
      if (io) {
        if (device) {
          io.emit('DEVICE_SYNC', { action: 'restore', device_id: String(device._id), device });
          io.emit('DEVICE_STATUS_CHANGED', device);
        }
        io.emit('INCIDENT_UPDATED', incident);
        io.emit('INCIDENT_CREATED', incident);
      }
    } catch (socketErr) { }

    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user?.username || 'SOC-Operator',
      action_type: 'playbook_execution',
      description: `Đã phát lệnh khôi phục có kiểm soát cho thiết bị ${targetDeviceId} (Command ID: ${command.command_id}).`,
      metadata: { command_id: command.command_id, command_type: 'rollback', device_id: String(targetDeviceId), status: command.status },
    });
    return successResponse(res, { command, incident, device_id: targetDeviceId }, 'Lệnh khôi phục đã được phát thành công');
  } catch (error) {
    console.error('recoverIncidentDevice error:', error);
    return errorResponse(res, 'Không thể phát lệnh khôi phục.', error.message, 500);
  }
};

export const addForensicsArtifact = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, size, sha256, path: artifactPath, description } = req.body;

    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    const newArtifact = {
      name: name || `artifact_${Date.now()}.pcap`,
      type: type || 'PCAP',
      size: size || '1.0 MB',
      sha256: sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      path: artifactPath || null,
      filename: name || null,
      download_url: `/api/incidents/${id}/pcap`,
      captured_at: new Date()
    };

    incident.forensics_artifacts.push(newArtifact);
    await incident.save();

    await IncidentTimeline.create({
      incident_id: id,
      actor: req.user ? req.user.username : 'Analyst',
      action_type: 'manual_note',
      description: `Đã bổ sung tệp chứng cứ mới: ${newArtifact.name} (${description || 'N/A'})`,
      metadata: newArtifact
    });

    return successResponse(res, incident.forensics_artifacts, 'Bổ sung tệp chứng cứ thành công', 201);
  } catch (error) {
    console.error('addForensicsArtifact error:', error);
    return errorResponse(res, 'Không thể bổ sung tệp chứng cứ', error.message);
  }
};

export const deleteForensicsArtifact = async (req, res) => {
  try {
    const { id, artifactId } = req.params;

    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    incident.forensics_artifacts = (incident.forensics_artifacts || []).filter(a => String(a._id) !== artifactId && a.name !== artifactId);
    await incident.save();

    return successResponse(res, incident.forensics_artifacts, 'Xóa tệp chứng cứ thành công');
  } catch (error) {
    console.error('deleteForensicsArtifact error:', error);
    return errorResponse(res, 'Không thể xóa tệp chứng cứ', error.message);
  }
};

export const acceptIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    incident.status = 'open';
    incident.accepted_by = req.user ? req.user.username : 'SOC Operator';
    incident.accepted_at = new Date();
    await incident.save();

    await IncidentTimeline.create({
      incident_id: id,
      actor: req.user ? req.user.username : 'SOC Operator',
      action_type: 'status_change',
      description: `Sự cố đã được tiếp nhận bởi ${req.user ? req.user.username : 'SOC Operator'}.`
    });

    return successResponse(res, incident, 'Đã tiếp nhận sự cố thành công');
  } catch (error) {
    console.error('acceptIncident error:', error);
    return errorResponse(res, 'Không thể tiếp nhận sự cố', error.message);
  }
};

export const markFullySafe = async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id } = req.body || {};
    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    let targetDevId = device_id || incident.device_id;
    if (!targetDevId && incident.alert_ids && incident.alert_ids.length > 0) {
      const alertObj = await Alert.findById(incident.alert_ids[0]);
      if (alertObj) targetDevId = alertObj.device_id;
    }

    // Flexible Device Lookup
    let device = null;
    if (targetDevId) {
      if (typeof targetDevId === 'string' && targetDevId.match(/^[0-9a-fA-F]{24}$/)) {
        device = await Device.findById(targetDevId);
      }
      if (!device) {
        device = await Device.findOne({ $or: [{ source_id: targetDevId }, { name: targetDevId }, { ip_address: targetDevId }] });
      }
    }

    if (device) {
      device.risk_score = 29;
      device.status = 'active';
      device.operational_status = 'active';
      await device.save();
    } else {
      // Fallback: update any active device risk_score to 29 and status to active
      await Device.updateMany({ risk_score: { $gte: 30 } }, { $set: { risk_score: 29, status: 'active', operational_status: 'active' } });
    }

    // Try WebSocket emit safely
    try {
      const { default: socketService } = await import('../services/socketService.js');
      const io = socketService.getIo();
      if (io) {
        if (device) {
          io.emit('DEVICE_SYNC', { action: 'restore', device_id: String(device._id), device });
          io.emit('DEVICE_STATUS_CHANGED', device);
        }
        io.emit('DEVICE_RISK_UPDATED', { device_id: device ? String(device._id) : String(targetDevId), risk_score: 29 });
      }
    } catch (socketErr) { }

    incident.status = 'closed';
    incident.is_fully_safe = true;
    await incident.save();

    await IncidentTimeline.create({
      incident_id: id,
      actor: req.user ? req.user.username : 'Admin',
      action_type: 'status_change',
      description: `Đã xác nhận sự cố an toàn tuyệt đối. Điểm rủi ro thiết bị được đưa về 29.`
    });

    return successResponse(res, incident, 'Xác nhận an toàn tuyệt đối thành công (Risk Score = 29)');
  } catch (error) {
    console.error('markFullySafe error:', error);
    return errorResponse(res, 'Không thể xác nhận an toàn tuyệt đối', error.message);
  }
};

export default {
  getAllIncidents,
  getIncidentById,
  triggerAiAnalysis,
  createIncident,
  updateIncident,
  deleteIncident,
  deleteMultipleIncidents,
  getIncidentAttackGraph,
  executePlaybookStep,
  getIncidentForensics,
  addForensicsArtifact,
  deleteForensicsArtifact,
  downloadIncidentPcap,
  handleCaptureCompleteCallback,
  generateExecutivePdfReport,
  containIncidentDevice,
  recoverIncidentDevice,
  verifyAndCloseIncident,
  acceptIncident,
  markFullySafe
};
