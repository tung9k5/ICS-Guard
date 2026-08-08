import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ShieldAlert, HeartPulse, Shield, CheckCircle2, LockKeyhole, RotateCcw, Wifi, Cpu, Server, Radio, Database } from 'lucide-react';
import { NetworkTrafficChart, ThreatActivityChart, SystemHealthChart } from '@/sections/Dashboard';

import VButton from '@/components/VButton';
import dashboardApi from '@/api/dashboard';
import incidentApi from '@/api/incidents';
import deviceApi from '@/api/device';
import {
  CommandPollingTimeoutError,
  extractCommand,
  pollCommandStatus,
} from '@/api/commands';
import socket from '@/services/socket';
import { toast } from '@/utils/toast';
import EmergencyIncidentModal from '@/components/modals/EmergencyIncidentModal';
import { hasFreshAiAdvice, selectLatestAiAdvice } from '@/components/modals/EmergencyIncidentModal/responseWorkspaceUtils';
import './Dashboard.scss';

const Dashboard = () => {
  const { t } = useTranslation();
  
  const [networkData, setNetworkData] = useState([]);
  const [threatData, setThreatData] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [riskData, setRiskData] = useState({ averageRisk: 0, topDevices: [] });
  const [responseCase, setResponseCase] = useState(null);
  const [activeIncidentsList, setActiveIncidentsList] = useState([]);
  const [activeIncidentIndex, setActiveIncidentIndex] = useState(0);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseAction, setResponseAction] = useState('');
  const [activeCommand, setActiveCommand] = useState(null);
  const [commandPollingError, setCommandPollingError] = useState('');

  const responseRequestRef = useRef(0);
  const commandPollAbortRef = useRef(null);
  const aiPollTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      commandPollAbortRef.current?.abort();
      if (aiPollTimerRef.current) window.clearTimeout(aiPollTimerRef.current);
    };
  }, []);

  const fetchRiskStatus = async (options = {}) => {
    try {
      const res = await dashboardApi.getRiskStatus(options);
      if (res) {
        setRiskData(res.status === 'success' ? res.data : res);
      }
    } catch (error) {
      console.error('Failed to fetch risk status', error);
    }
  };

  const fetchResponseCase = async (options = {}, targetIndex = 0) => {
    const requestId = ++responseRequestRef.current;

    try {
      if (options.skipLoading !== true) {
        setResponseLoading(true);
      }

      const incidentsRes = await incidentApi.getAll({
        order: 'desc',
        page: 1,
        per_page: 100
      }, options);
      const incidents = Array.isArray(incidentsRes?.data) ? incidentsRes.data : [];
      const activeList = incidents.filter(item => {
        const st = String(item?.status || '').toLowerCase();
        if (['closed', 'resolved', 'remediated'].includes(st)) return false;
        if (item?.is_fully_safe === true) return false;
        return ['unassigned', 'pending', 'open', 'investigating'].includes(st);
      });

      // Sort: prioritize unassigned/pending (0) -> open (1) -> investigating (2), newest first
      activeList.sort((a, b) => {
        const orderMap = { unassigned: 0, pending: 0, open: 1, investigating: 2 };
        const stA = orderMap[String(a?.status).toLowerCase()] ?? 3;
        const stB = orderMap[String(b?.status).toLowerCase()] ?? 3;
        if (stA !== stB) return stA - stB;
        return new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0);
      });

      setActiveIncidentsList(activeList);

      if (activeList.length === 0) {
        if (mountedRef.current && requestId === responseRequestRef.current) {
          setResponseCase(null);
        }
        return null;
      }

      const safeIndex = (targetIndex % activeList.length + activeList.length) % activeList.length;
      setActiveIncidentIndex(safeIndex);
      const incident = activeList[safeIndex];

      const incidentId = incident._id || incident.id;
      const details = await incidentApi.getById(incidentId, options);
      const detailPayload = details?.data || details;
      const detailedIncident = detailPayload?.incident || incident;
      const timeline = Array.isArray(detailPayload?.timeline) ? detailPayload.timeline : [];
      
      // Extract alert object and device ID reliably
      const alertObj = Array.isArray(detailedIncident.alert_ids) ? detailedIncident.alert_ids[0] : null;
      const alert = (alertObj && typeof alertObj === 'object') ? alertObj : null;
      const rawDevId = alert?.device_id || detailedIncident.device_id || (typeof alertObj === 'string' ? alertObj : null);
      const deviceId = rawDevId || 'plc-water-01';
      let device = null;

      if (deviceId && deviceId !== 'dummy-device') {
        try {
          const deviceRes = await deviceApi.getById(deviceId, options);
          device = deviceRes?.data?.device || deviceRes?.device || deviceRes?.data || deviceRes;
        } catch (err) {
          console.warn('Dashboard response device lookup failed', err?.message || err);
        }
      }

      const newestTimeline = [...timeline].reverse();
      const isolationTimeline = newestTimeline.find((item) => {
        const text = `${item.action_type || ''} ${item.description || ''}`.toLowerCase();
        return text.includes('isolate') || text.includes('isolat') || text.includes('co lap') || text.includes('cô lập');
      });

      const aiAdviceEntry = selectLatestAiAdvice(timeline);
      const aiAdvice = aiAdviceEntry ? aiAdviceEntry.description : null;

      const nextCase = {
        incident: detailedIncident,
        timeline,
        alert,
        device,
        deviceId,
        aiAdvice,
        aiAdviceId: aiAdviceEntry?._id || aiAdviceEntry?.id || null,
        aiAdviceAt: aiAdviceEntry ? (aiAdviceEntry.event_time || aiAdviceEntry.createdAt || null) : null,
        isolatedAt: isolationTimeline?.event_time || isolationTimeline?.createdAt || null
      };

      if (mountedRef.current && requestId === responseRequestRef.current) {
        setResponseCase(nextCase);
      }
      return nextCase;
    } catch (error) {
      console.error('Failed to fetch response case', error);
      return undefined;
    } finally {
      if (mountedRef.current && requestId === responseRequestRef.current) {
        setResponseLoading(false);
      }
    }
  };

  useEffect(() => {
    const fetchDashboardStats = async (options = {}) => {
      try {
        const [network, threat, health] = await Promise.all([
          dashboardApi.getNetworkTraffic(options),
          dashboardApi.getThreatActivity(options),
          dashboardApi.getSystemHealth(options)
        ]);
        
        if (network && network.status === 'success') {
          setNetworkData(network.data || network);
        } else {
          setNetworkData(network || []);
        }

        if (threat && threat.status === 'success') {
          setThreatData(threat.data || threat);
        } else {
          setThreatData(threat || []);
        }

        if (health && health.status === 'success') {
          setHealthData(health.data || health);
        } else {
          setHealthData(health || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchDashboardStats();
    fetchRiskStatus();
    fetchResponseCase();

    const interval = setInterval(() => {
      fetchDashboardStats({ skipLoading: true });
      fetchRiskStatus({ skipLoading: true });
      fetchResponseCase({ skipLoading: true });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getRiskClass = (score) => {
    if (score >= 70) return 'risk-high';
    if (score >= 30) return 'risk-medium';
    return 'risk-low';
  };

  const getRiskStatusText = (score) => {
    if (score >= 70) return 'CẢNH BÁO CAO (CRITICAL)';
    if (score >= 30) return 'CẢNH BÁO TRUNG BÌNH (WARNING)';
    return 'HỆ THỐNG AN TOÀN (NORMAL)';
  };

  const getSeverityClass = (severity) => {
    const normalized = String(severity || '').toUpperCase();
    if (normalized === 'CRITICAL') return 'severity-critical';
    if (normalized === 'HIGH') return 'severity-high';
    if (normalized === 'MEDIUM') return 'severity-medium';
    return 'severity-low';
  };

  const issueAndTrackCommand = async (commandType, issueCommandFn) => {
    let controller = null;
    try {
      setResponseAction(commandType);
      setActiveCommand(null);
      setCommandPollingError('');

      const res = await issueCommandFn();
      if (!mountedRef.current) return null;
      const rawCommand = extractCommand(res);
      const commandId = rawCommand?.command_id || res?.data?.command_id || res?.command_id;

      if (!commandId) {
        await refreshResponseWorkflow();
        return;
      }

      controller = new AbortController();
      commandPollAbortRef.current = controller;

      const finalStatus = await pollCommandStatus(commandId, {
        signal: controller.signal,
        onUpdate: (commandState) => {
          if (!mountedRef.current) return;
          setActiveCommand(commandState);
          if (commandState?.target_id && responseCase?.device) {
            setResponseCase((prev) => (
              prev
                ? {
                  ...prev,
                  device: {
                    ...prev.device,
                    security_status: commandState.status === 'succeeded'
                      ? (commandType === 'isolate' ? 'isolated' : 'normal')
                      : prev.device.security_status,
                  },
                }
                : prev
            ));
          }
        },
      });

      if (!mountedRef.current) return finalStatus;

      if (finalStatus?.status === 'succeeded') {
        toast.success(
          commandType === 'isolate'
            ? 'Thiết bị đã được cô lập khẩn cấp khỏi mạng OT thành công!'
            : 'Đã khôi phục thanh ghi PLC về trạng thái an toàn.',
        );
      }
      await refreshResponseWorkflow();
      return finalStatus;
    } catch (error) {
      if (!mountedRef.current) return null;
      if (error instanceof CommandPollingTimeoutError) {
        setCommandPollingError('Hết thời gian polling xác nhận lệnh.');
        await refreshResponseWorkflow();
      } else {
        toast.error(error?.message || 'Không thể phát hành lệnh.');
      }
      return null;
    } finally {
      if (commandPollAbortRef.current === controller) commandPollAbortRef.current = null;
      if (mountedRef.current) setResponseAction('');
    }
  };

  const refreshResponseWorkflow = async () => {
    await fetchResponseCase({ skipLoading: true });
    await fetchRiskStatus({ skipLoading: true });
  };

  const handleIsolateDevice = async () => {
    const deviceId = responseCase?.deviceId || responseCase?.device?._id;
    if (!deviceId) {
      toast.error('Không xác định được thiết bị mục tiêu. Không thể phát lệnh cô lập.');
      return;
    }
    const incidentId = responseCase?.incident?._id || responseCase?.incident?.id;
    if (!incidentId) {
      toast.error('Không xác định được incident. Lệnh cô lập đã bị chặn.');
      return;
    }
    await issueAndTrackCommand('isolate', () => incidentApi.contain(incidentId, { device_id: deviceId }));
  };

  const handleAiRemediation = async () => {
    const incidentId = responseCase?.incident?._id || responseCase?.incident?.id;
    if (!incidentId) return;

    try {
      setResponseAction('ai');
      const previousAdviceId = responseCase?.aiAdviceId || null;
      const requestedAt = Date.now();
      await incidentApi.triggerAiAnalysis(incidentId);
      if (!mountedRef.current) return;
      toast.info('Yêu cầu chẩn đoán sự cố an ninh đã được gửi tới trợ lý AI.');

      let attempts = 0;
      const pollForAiAdvice = async () => {
        if (!mountedRef.current) return;
        attempts++;
        const nextCase = await fetchResponseCase({ skipLoading: true });
        if (!mountedRef.current) return;
        const adviceIsFresh = hasFreshAiAdvice(nextCase, previousAdviceId, requestedAt);
        if (adviceIsFresh || attempts >= 60) {
          aiPollTimerRef.current = null;
          setResponseAction('');
          if (adviceIsFresh) {
            toast.success('Trợ lý AI đã hoàn tất báo cáo chẩn đoán sự cố.');
          } else {
            toast.error('Thời gian yêu cầu AI chẩn đoán phản hồi quá lâu.');
          }
          return;
        }
        aiPollTimerRef.current = window.setTimeout(pollForAiAdvice, 2000);
      };
      if (aiPollTimerRef.current) window.clearTimeout(aiPollTimerRef.current);
      aiPollTimerRef.current = window.setTimeout(pollForAiAdvice, 2000);
    } catch (error) {
      if (mountedRef.current) {
        toast.error(error?.message || 'Không thể gửi yêu cầu phân tích tới AI.');
        setResponseAction('');
      }
    }
  };

  const handleRestoreDevice = async () => {
    const deviceId = responseCase?.deviceId || responseCase?.device?._id;
    if (!deviceId) {
      toast.error('Không xác định được thiết bị mục tiêu. Không thể phát lệnh khôi phục.');
      return;
    }
    const incidentId = responseCase?.incident?._id || responseCase?.incident?.id;
    if (!incidentId) {
      toast.error('Không xác định được incident. Không thể khôi phục thiết bị.');
      return;
    }
    const finalStatus = await issueAndTrackCommand('restore', () => incidentApi.recover(incidentId, { device_id: deviceId }));
    if (finalStatus?.status === 'succeeded') {
      setResponseCase(previous => previous ? { ...previous, recoveryCompleted: true } : previous);
    }
  };

  const handleCloseIncident = async (verificationPayload) => {
    const incidentId = responseCase?.incident?._id || responseCase?.incident?.id;
    if (!incidentId) return;
    if (!window.confirm('Đóng sự cố sau khi xác minh sẽ kết thúc quy trình ứng phó. Bạn có chắc muốn tiếp tục?')) return;
    try {
      setResponseAction('close');
      await incidentApi.verifyAndClose(incidentId, verificationPayload);
      toast.success('Sự cố đã được xác minh và đóng thành công.');
      setResponseCase(null);
    } catch (error) {
      toast.error(error?.message || 'Không thể đóng sự cố.');
    } finally {
      setResponseAction('');
    }
  };

  return (
    <div className="soc-dashboard-container">
      {/* SOC Command Header */}
      <div className="soc-header-summary">
        <div className="soc-title-section">
          <h1>Trung Tâm Giám Sát SOC & An Ninh Mạng Công Nghiệp (ICS/SCADA SOC)</h1>
          <p>Hệ thống giám sát thời gian thực luồng dữ liệu Modbus TCP/S7comm, chỉ số đe dọa và điều khiển ứng phó sự cố.</p>
        </div>
      </div>

      <div className="soc-dashboard-grid">
        {/* 1. Network Traffic Activity */}
        <div className="soc-dashboard-card full-width">
          <div className="soc-card-header">
            <div className="icon-badge blue">
              <Activity size={20} />
            </div>
            <div>
              <h3>Lưu Lượng Truyền Tải Mạng OT (Network Traffic Stream)</h3>
              <p className="card-subtitle">Tần suất và băng thông gói tin Modbus/S7comm 24h qua</p>
            </div>
          </div>
          <div className="soc-card-body">
            <NetworkTrafficChart data={networkData} />
          </div>
        </div>

        {/* 2. Threat Activity Level */}
        <div className="soc-dashboard-card">
          <div className="soc-card-header">
            <div className="icon-badge red">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3>Mức Độ Đe Dọa An Ninh (Threat Activity Level)</h3>
              <p className="card-subtitle">Tần suất các vi phạm quy tắc NIDS phát hiện</p>
            </div>
          </div>
          <div className="soc-card-body">
            <ThreatActivityChart rawData={threatData} />
          </div>
        </div>

        {/* 3. Average Network Risk */}
        <div className="soc-dashboard-card">
          <div className="soc-card-header">
            <div className="icon-badge orange">
              <Shield size={20} />
            </div>
            <div>
              <h3>Chỉ Số Rủi Ro Mạng Lưới (Average Risk Level)</h3>
              <p className="card-subtitle">Điểm tổng hợp độ nhạy rủi ro của toàn bộ tài sản OT</p>
            </div>
          </div>
          <div className="soc-card-body risk-card-body">
            <div className="risk-gauge-container">
              <div className={`risk-value-circle ${getRiskClass(riskData.averageRisk)}`}>
                <span className="risk-number">{riskData.averageRisk}</span>
                <span className="risk-unit">%</span>
              </div>
            </div>
            <div className="risk-info">
              <div className={`risk-status-tag ${getRiskClass(riskData.averageRisk)}`}>
                {getRiskStatusText(riskData.averageRisk)}
              </div>
              <p className="risk-subtext">Hệ thống phân tích rủi ro cập nhật thời gian thực từ NIDS và Nhật ký telemetry.</p>
            </div>
          </div>
        </div>

        {/* 4. System Health Status */}
        <div className="soc-dashboard-card">
          <div className="soc-card-header">
            <div className="icon-badge green">
              <HeartPulse size={20} />
            </div>
            <div>
              <h3>Trạng Thái Sức Khỏe Hệ Thống (System Health Status)</h3>
              <p className="card-subtitle">Tải CPU, Bộ nhớ RAM và Băng thông mạng SOC</p>
            </div>
          </div>
          <div className="soc-card-body">
            <SystemHealthChart rawData={healthData} />
          </div>
        </div>

        {/* 5. Top 5 High-Risk Devices */}
        <div className="soc-dashboard-card">
          <div className="soc-card-header">
            <div className="icon-badge purple">
              <Server size={20} />
            </div>
            <div>
              <h3>Thiết Bị Nguy Cơ Cao Hàng Đầu (Top High-Risk Assets)</h3>
              <p className="card-subtitle">Các PLC/Gateway đang có điểm đe dọa cao nhất</p>
            </div>
          </div>
          <div className="soc-card-body">
            <table className="top-devices-table">
              <thead>
                <tr>
                  <th>Tên thiết bị</th>
                  <th>IP Address</th>
                  <th>Phân vùng</th>
                  <th>Rủi ro</th>
                </tr>
              </thead>
              <tbody>
                {riskData.topDevices && riskData.topDevices.length > 0 ? (
                  riskData.topDevices.map((device, idx) => (
                    <tr key={device._id || idx}>
                      <td className="device-name-cell">
                        <strong>{device.name}</strong>
                      </td>
                      <td><code>{device.ip_address || device.ipAddress}</code></td>
                      <td><span className="zone-pill">{device.zone || 'Zone-A'}</span></td>
                      <td>
                        <span className={`risk-pill ${getRiskClass(device.risk_score)}`}>
                          {device.risk_score || 0}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="empty-table-cell">Hệ thống hoạt động an toàn, không có thiết bị nguy cơ cao.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pop-up Modal Xử Lý Sự Cố Khẩn Cấp (Emergency Incident Command Drawer) */}
      <EmergencyIncidentModal
        visible={Boolean(responseCase?.incident) && !['closed', 'resolved'].includes(String(responseCase?.incident?.status).toLowerCase())}
        responseCase={responseCase}
        responseLoading={responseLoading}
        responseAction={responseAction}
        activeCommand={activeCommand}
        commandPollingError={commandPollingError}
        onIsolate={handleIsolateDevice}
        onAiRemediation={handleAiRemediation}
        onRestore={handleRestoreDevice}
        onCloseIncident={handleCloseIncident}
        onAcceptIncident={() => fetchResponseCase({ skipLoading: true }, activeIncidentIndex)}
        onPrevIncident={activeIncidentsList.length > 1 ? () => fetchResponseCase({ skipLoading: true }, activeIncidentIndex - 1) : null}
        onNextIncident={activeIncidentsList.length > 1 ? () => fetchResponseCase({ skipLoading: true }, activeIncidentIndex + 1) : null}
        currentIndex={activeIncidentIndex}
        totalIncidents={activeIncidentsList.length}
      />
    </div>
  );
};

export default Dashboard;
