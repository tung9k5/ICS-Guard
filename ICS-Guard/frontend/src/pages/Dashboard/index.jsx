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
import './Dashboard.scss';

const Dashboard = () => {
  const { t } = useTranslation();
  
  const [networkData, setNetworkData] = useState([]);
  const [threatData, setThreatData] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [riskData, setRiskData] = useState({ averageRisk: 0, topDevices: [] });
  const [responseCase, setResponseCase] = useState(null);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseAction, setResponseAction] = useState('');
  const [activeCommand, setActiveCommand] = useState(null);
  const [commandPollingError, setCommandPollingError] = useState('');

  const responseRequestRef = useRef(0);
  const commandPollAbortRef = useRef(null);

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

  const fetchResponseCase = async (options = {}) => {
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
      const incident = incidents.find((item) =>
        ['open', 'investigating'].includes(String(item?.status).toLowerCase())
      );

      if (!incident) {
        if (requestId === responseRequestRef.current) {
          setResponseCase(null);
        }
        return null;
      }

      const incidentId = incident._id || incident.id;
      const details = await incidentApi.getById(incidentId, options);
      const detailPayload = details?.data || details;
      const detailedIncident = detailPayload?.incident || incident;
      const timeline = Array.isArray(detailPayload?.timeline) ? detailPayload.timeline : [];
      const alert = Array.isArray(detailedIncident.alert_ids) ? detailedIncident.alert_ids[0] : null;
      const deviceId = alert?.device_id || detailedIncident.device_id;
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

      const aiAdviceEntry = newestTimeline.find(item => item.action_type === 'ai_analysis' && item.description && !item.description.includes('đã được gửi'));
      const aiAdvice = aiAdviceEntry ? aiAdviceEntry.description : null;

      const nextCase = {
        incident: detailedIncident,
        timeline,
        alert,
        device,
        deviceId,
        aiAdvice,
        isolatedAt: isolationTimeline?.event_time || isolationTimeline?.createdAt || null
      };

      if (requestId === responseRequestRef.current) {
        setResponseCase(nextCase);
      }
      return nextCase;
    } catch (error) {
      console.error('Failed to fetch response case', error);
      return undefined;
    } finally {
      if (requestId === responseRequestRef.current) {
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

  const getDeviceSecurityStatus = () => (
    responseCase?.device?.security_status
    || responseCase?.device?.status
    || 'normal'
  );

  const isDeviceIsolated = () => {
    const status = getDeviceSecurityStatus();
    return status === 'isolated' || status === 'quarantined';
  };

  const isRestoreConfirmed = () => (
    !isDeviceIsolated()
    && getDeviceSecurityStatus() === 'normal'
    && responseCase?.incident?.status === 'closed'
  );

  const issueAndTrackCommand = async (commandType, issueCommandFn) => {
    try {
      setResponseAction(commandType);
      setCommandPollingError('');

      const res = await issueCommandFn();
      const rawCommand = extractCommand(res);
      const commandId = rawCommand?.command_id || res?.data?.command_id || res?.command_id;

      if (!commandId) {
        await refreshResponseWorkflow();
        return;
      }

      const controller = new AbortController();
      commandPollAbortRef.current = controller;

      const finalStatus = await pollCommandStatus(commandId, {
        signal: controller.signal,
        onUpdate: (commandState) => {
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

      if (finalStatus?.status === 'succeeded') {
        toast.success(
          commandType === 'isolate'
            ? 'Thiết bị đã được cô lập khẩn cấp khỏi mạng OT thành công!'
            : 'Đã khôi phục thanh ghi PLC về trạng thái an toàn.',
        );
      }
      await refreshResponseWorkflow();
    } catch (error) {
      if (error instanceof CommandPollingTimeoutError) {
        setCommandPollingError('Hết thời gian polling xác nhận lệnh.');
        await refreshResponseWorkflow();
      } else {
        toast.error(error?.message || 'Không thể phát hành lệnh.');
      }
    } finally {
      setResponseAction('');
    }
  };

  const refreshResponseWorkflow = async () => {
    await fetchResponseCase({ skipLoading: true });
    await fetchRiskStatus({ skipLoading: true });
  };

  const handleIsolateDevice = async () => {
    const deviceId = responseCase?.deviceId || responseCase?.device?._id || 'plc-water-01';
    const incidentId = responseCase?.incident?._id || responseCase?.incident?.id;
    await issueAndTrackCommand('isolate', () => (
      incidentId
        ? incidentApi.contain(incidentId, { device_id: deviceId })
        : deviceApi.isolate(deviceId)
    ));
  };

  const handleAiRemediation = async () => {
    const incidentId = responseCase?.incident?._id || responseCase?.incident?.id;
    if (!incidentId) return;

    try {
      setResponseAction('ai');
      await incidentApi.triggerAiAnalysis(incidentId);
      toast.info('Yêu cầu chẩn đoán sự cố an ninh đã được gửi tới trợ lý AI.');

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const nextCase = await fetchResponseCase({ skipLoading: true });
        if (nextCase?.aiAdvice || attempts >= 60) {
          clearInterval(interval);
          setResponseAction('');
          if (nextCase?.aiAdvice) {
            toast.success('Trợ lý AI đã hoàn tất báo cáo chẩn đoán sự cố.');
          } else {
            toast.error('Thời gian yêu cầu AI chẩn đoán phản hồi quá lâu.');
          }
        }
      }, 2000);
    } catch (error) {
      toast.error(error?.message || 'Không thể gửi yêu cầu phân tích tới AI.');
      setResponseAction('');
    }
  };

  const handleRestoreDevice = async () => {
    const deviceId = responseCase?.deviceId || responseCase?.device?._id || 'plc-water-01';
    await issueAndTrackCommand('restore', () => deviceApi.rollback(deviceId));
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
        onIsolate={handleIsolateDevice}
        onAiRemediation={handleAiRemediation}
        onRestore={handleRestoreDevice}
      />
    </div>
  );
};

export default Dashboard;
