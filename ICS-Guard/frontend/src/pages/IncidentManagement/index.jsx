import React, { useState, useEffect } from 'react';
import { ShieldAlert, Bell, Activity, FileText, CheckCircle2, LockKeyhole, RotateCcw, AlertTriangle, Layers, Filter, Eye, Download, Play, Plus, RefreshCw, Cpu } from 'lucide-react';
import VButton from '@/components/VButton';
import VDialog from '@/components/VDialog';
import incidentsApi from '@/api/incidents';
import alertsApi from '@/api/alerts';
import deviceApi from '@/api/device';
import { toast } from '@/utils/toast';
import './IncidentManagement.scss';

const IncidentManagement = ({ initialTab = 'war-room' }) => {
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'alerts' || tabParam === 'triage') return 'triage';
    if (tabParam === 'forensics') return 'forensics';
    return initialTab;
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl); // 'triage' | 'war-room' | 'forensics'
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isWarRoomModalOpen, setIsWarRoomModalOpen] = useState(false);

  // Attack Graph & Forensics data
  const [attackGraph, setAttackGraph] = useState(null);
  const [forensicsData, setForensicsData] = useState(null);
  const [pdfReport, setPdfReport] = useState(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await incidentsApi.getAll({ order: 'desc', page: 1, per_page: 50 });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setIncidents(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await alertsApi.getAllAlerts({ page: 1, per_page: 50 });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setAlerts(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchIncidents();
    fetchAlerts();
  }, []);

  useEffect(() => {
    const handleUrlChange = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleOpenWarRoom = async (incident) => {
    setSelectedIncident(incident);
    setIsWarRoomModalOpen(true);

    const incId = incident._id || incident.id;
    try {
      const [graphRes, forenRes, pdfRes] = await Promise.all([
        incidentsApi.getAttackGraph(incId),
        incidentsApi.getForensics(incId),
        incidentsApi.getPdfReport(incId)
      ]);
      setAttackGraph(graphRes?.data || graphRes);
      setForensicsData(forenRes?.data || forenRes);
      setPdfReport(pdfRes?.data || pdfRes);
    } catch (e) {
      console.error('Failed to load War Room details', e);
    }
  };

  const handleAlertAction = async (alertId, action) => {
    try {
      if (action === 'ESCALATE') {
        const res = await alertsApi.updateAlertStatus(alertId, 'escalated');
        toast.success('Đã leo thang cảnh báo thành Sự Cố Khẩn Cấp (Critical Incident)!');
        fetchIncidents();
        fetchAlerts();
      } else if (action === 'SUPPRESS') {
        await alertsApi.updateAlertStatus(alertId, 'false_positive');
        toast.info('Đã đánh dấu báo động giả (False Positive Suppressed).');
        fetchAlerts();
      } else {
        await alertsApi.updateAlertStatus(alertId, 'acknowledged');
        toast.success('Đã xác nhận cảnh báo (Acknowledged).');
        fetchAlerts();
      }
    } catch (e) {
      toast.error('Lỗi khi thực thi thao tác Triage');
    }
  };

  const handleExecuteIsolate = async (deviceId) => {
    try {
      await deviceApi.isolate(deviceId || 'plc-water-01');
      toast.success(`Đã cô lập thành công thiết bị ${deviceId || 'PLC'}!`);
      fetchIncidents();
    } catch (e) {
      toast.error('Lỗi cô lập thiết bị');
    }
  };

  const handleExecuteRollback = async (deviceId) => {
    try {
      await deviceApi.rollback(deviceId || 'plc-water-01');
      toast.success(`Đã khôi phục logic thanh ghi PLC ${deviceId || 'PLC'}!`);
      fetchIncidents();
    } catch (e) {
      toast.error('Lỗi khôi phục PLC');
    }
  };

  return (
    <div className="unified-warroom-page" style={{ padding: '24px', background: '#090d16', minHeight: 'calc(100vh - 70px)', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(59,130,246,0.2)', padding: '20px 24px', borderRadius: '14px', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
            <ShieldAlert size={26} color="#ef4444" />
            Trung Tâm Tác Chiến An Ninh OT & Xử Lý Sự Cố Khẩn Cấp (Unified OT SOC War Room)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.88rem' }}>
            Giám sát cảnh báo thời gian thực, điều phối sự cố 4 giai đoạn chuẩn ISO 27035 / NIST & Trích xuất bằng chứng NIDS.
          </p>
        </div>
        <VButton variant="primary" onClick={() => { fetchIncidents(); fetchAlerts(); }}>
          <RefreshCw size={16} /> Làm Mới Dữ Liệu
        </VButton>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('triage')}
          style={{
            padding: '12px 20px', background: 'none', border: 'none',
            borderBottom: activeTab === 'triage' ? '2px solid #3b82f6' : 'none',
            color: activeTab === 'triage' ? '#3b82f6' : '#94a3b8',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Bell size={18} /> Phân Tích Cảnh Báo Real-time ({alerts.length})
        </button>

        <button
          onClick={() => setActiveTab('war-room')}
          style={{
            padding: '12px 20px', background: 'none', border: 'none',
            borderBottom: activeTab === 'war-room' ? '2px solid #3b82f6' : 'none',
            color: activeTab === 'war-room' ? '#3b82f6' : '#94a3b8',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Activity size={18} /> Bảng Điều Phối Sự Cố (War Room Kanban) ({incidents.length})
        </button>

        <button
          onClick={() => setActiveTab('forensics')}
          style={{
            padding: '12px 20px', background: 'none', border: 'none',
            borderBottom: activeTab === 'forensics' ? '2px solid #3b82f6' : 'none',
            color: activeTab === 'forensics' ? '#3b82f6' : '#94a3b8',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <FileText size={18} /> Nhật Ký Bằng Chứng & PCAP Vault
        </button>
      </div>

      {/* Tab 1: Real-time Alert Triage */}
      {activeTab === 'triage' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {alerts.map((al) => (
              <div key={al._id} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '18px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ background: al.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: al.severity === 'CRITICAL' ? '#f87171' : '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                    {al.severity}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(al.detected_at || al.createdAt || Date.now()).toLocaleTimeString()}</span>
                </div>
                <h4 style={{ margin: '6px 0', fontSize: '15px', color: '#f8fafc' }}>{al.title || al.rule_name}</h4>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 12px', lineHeight: 1.4 }}>{al.description || 'Phát hiện luồng bất thường trên cổng Modbus TCP/S7comm.'}</p>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '14px' }}>
                  Source IP: <code style={{ color: '#38bdf8' }}>{al.source_ip || '192.168.10.100'}</code>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <VButton variant="danger" size="small" onClick={() => handleAlertAction(al._id, 'ESCALATE')}>
                    Leo Thang Sự Cố Khẩn Cấp
                  </VButton>
                  <VButton variant="secondary" size="small" onClick={() => handleAlertAction(al._id, 'SUPPRESS')}>
                    Báo Sai (Suppress)
                  </VButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: War Room Kanban Board */}
      {activeTab === 'war-room' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', overflowX: 'auto' }}>
          {['open', 'investigating', 'remediated', 'closed'].map((colStatus) => {
            const filtered = incidents.filter(i => (i.status || 'open').toLowerCase() === colStatus);
            const colTitles = { open: 'Mới Tiếp Nhận', investigating: 'Đang Điều Tra', remediated: 'Đã Cô Lập (Contained)', closed: 'Đã Khôi Phục (Closed)' };
            const colColors = { open: '#ef4444', investigating: '#f59e0b', remediated: '#3b82f6', closed: '#10b981' };

            return (
              <div key={colStatus} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', minHeight: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: `2px solid ${colColors[colStatus]}`, paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>{colTitles[colStatus]}</span>
                  <span style={{ background: '#1e293b', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', color: colColors[colStatus], fontWeight: 700 }}>
                    {filtered.length}
                  </span>
                </div>
                {filtered.map(inc => (
                  <div key={inc._id || inc.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '14px', marginBottom: '12px', cursor: 'pointer' }} onClick={() => handleOpenWarRoom(inc)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ background: inc.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: inc.severity === 'CRITICAL' ? '#f87171' : '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        {inc.severity}
                      </span>
                    </div>
                    <h5 style={{ margin: '4px 0 8px', fontSize: '14px', color: '#fff' }}>{inc.title}</h5>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.4 }}>{inc.description || 'Đang theo dõi sự cố an ninh...'}</p>
                    <VButton variant="primary" style={{ width: '100%', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); handleOpenWarRoom(inc); }}>
                      Mở Phòng Tác Chiến War Room
                    </VButton>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Forensics & PCAP Vault */}
      {activeTab === 'forensics' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
            <FileText size={20} /> Kho Bằng Chứng Báo Cáo Pháp Lý & PCAP Network Vault
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Mã Sự Cố</th>
                <th style={{ padding: '12px' }}>Tên Tập Tin Bằng Chứng</th>
                <th style={{ padding: '12px' }}>Loại Dữ Liệu</th>
                <th style={{ padding: '12px' }}>Mã SHA-256 Checksum (Xác Thực Bằng Chứng)</th>
                <th style={{ padding: '12px' }}>Tải Xuống</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Chưa có sự cố hoặc tệp bằng chứng nào được lưu trữ.</td>
                </tr>
              ) : (
                incidents.map(inc => {
                  const incId = inc._id || inc.id;
                  const artifactName = `incident_${String(incId).slice(-6)}_traffic.pcap`;
                  const pcapUrl = `${import.meta.env.VITE_API_URL || '/api'}/incidents/${incId}/pcap`;
                  const token = localStorage.getItem('access_token');

                  const handleDownload = async () => {
                    try {
                      const response = await fetch(pcapUrl, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!response.ok) {
                        toast.error('Tệp PCAP chưa sẵn sàng hoặc không tồn tại.');
                        return;
                      }
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = artifactName;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                      toast.success(`Đã tải xuống ${artifactName}`);
                    } catch (err) {
                      toast.error('Lỗi khi tải tệp PCAP');
                    }
                  };

                  return (
                    <tr key={incId} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#f1f5f9' }}>#{String(incId).slice(-8)}</td>
                      <td style={{ padding: '12px', color: '#38bdf8', fontFamily: 'monospace' }}>{artifactName}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          PCAP DUMP
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <code style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                          {inc.forensics_artifacts && inc.forensics_artifacts[0]?.sha256
                            ? inc.forensics_artifacts[0].sha256
                            : 'Đang thu thập khi sự cố xảy ra...'}
                        </code>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <VButton size="small" variant="secondary" onClick={handleDownload}>
                          <Download size={14} /> Tải PCAP
                        </VButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* War Room Dialog Modal */}
      {isWarRoomModalOpen && selectedIncident && (
        <VDialog
          visible={isWarRoomModalOpen}
          onHide={() => setIsWarRoomModalOpen(false)}
          header={`Phòng Tác Chiến War Room: ${selectedIncident.title}`}
        >
          <div style={{ padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{selectedIncident.description}</p>
              {/* Enforcement Mode Badge */}
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🛡️ REAL ENFORCEMENT (Docker/iptables Layer-3 Ready)
              </span>
            </div>
            
            {/* 1-Click Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', background: '#0f172a', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
              <VButton variant="danger" onClick={() => handleExecuteIsolate(selectedIncident.device_id)}>
                <LockKeyhole size={16} /> 1-Click Cô Lập Thiết Bị Khẩn Cấp
              </VButton>
              <VButton variant="primary" onClick={() => handleExecuteRollback(selectedIncident.device_id)}>
                <RotateCcw size={16} /> Khôi Phục Logic PLC (Rollback)
              </VButton>
            </div>

            {/* Attack Graph with Edges */}
            {attackGraph && (
              <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
                <h4 style={{ margin: '0 0 12px', color: '#38bdf8', fontSize: '14px' }}>Sơ Đồ Chuỗi Tấn Công Động (MITRE ATT&CK for ICS Graph):</h4>
                
                {/* Graph Nodes */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {attackGraph.nodes?.map((node, idx) => (
                    <div key={idx} style={{
                      background: '#1e293b',
                      border: `1px solid ${node.status === 'ATTACKED' || node.status === 'CRITICAL' ? '#ef4444' : '#334155'}`,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '12px',
                      minWidth: '130px'
                    }}>
                      <strong style={{ color: '#fff', display: 'block', fontSize: '12px' }}>{node.label}</strong>
                      <span style={{ color: '#60a5fa', fontSize: '10px', display: 'block', marginTop: '2px' }}>Type: {node.type}</span>
                      <span style={{ color: '#94a3b8', fontSize: '10px' }}>Zone: {node.zone}</span>
                    </div>
                  ))}
                </div>

                {/* Graph Edges / Attack Vector Flow */}
                {attackGraph.edges && attackGraph.edges.length > 0 && (
                  <div style={{ marginTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Luồng Tấn Công Chi Tiết (Attack Vectors):</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      {attackGraph.edges.map((edge, eIdx) => (
                        <div key={eIdx} style={{ fontSize: '11px', color: '#cbd5e1', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>⚡ [{edge.protocol || 'TCP'}]</span>
                          <span>{edge.source} ➔ {edge.target}:</span>
                          <span style={{ color: '#94a3b8' }}>{edge.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </VDialog>
      )}
    </div>
  );
};

export default IncidentManagement;
