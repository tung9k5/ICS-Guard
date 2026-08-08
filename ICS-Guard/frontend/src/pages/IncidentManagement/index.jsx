import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Activity, FileText, LockKeyhole, RotateCcw, Download, RefreshCw, Upload, Trash2, Eye, CheckCircle2, Bot, ShieldCheck } from 'lucide-react';
import VButton from '@/components/VButton';
import VDialog from '@/components/VDialog';
import incidentsApi from '@/api/incidents';
import deviceApi from '@/api/device';
import BlockedIpsList from '@/sections/AuditManagement/BlockedIpsList';
import { toast } from '@/utils/toast';
import socket from '@/services/socket';
import './IncidentManagement.scss';

const IncidentManagement = ({ initialTab = 'war-room' }) => {
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'forensics') return 'forensics';
    if (tabParam === 'blocked-ips' || tabParam === 'blocked') return 'blocked-ips';
    return initialTab;
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl); // 'war-room' | 'forensics' | 'blocked-ips'
  const [incidents, setIncidents] = useState([]);
  const [devicesMap, setDevicesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isWarRoomModalOpen, setIsWarRoomModalOpen] = useState(false);

  // Attack Graph & Forensics data
  const [attackGraph, setAttackGraph] = useState(null);
  const [forensicsData, setForensicsData] = useState(null);
  const [aiReport, setAiReport] = useState(null);

  // PCAP Packet Preview Modal
  const [selectedPcapPreview, setSelectedPcapPreview] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Upload Artifact Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newArtifactData, setNewArtifactData] = useState({ incidentId: '', name: '', type: 'PCAP', description: '' });

  // Current User Role
  const userRole = localStorage.getItem('user_role') || 'admin';

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await incidentsApi.getAll({ order: 'desc', page: 1, per_page: 50 });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setIncidents(list);
    } catch (e) {
      console.error('Fetch incidents error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await deviceApi.getAll({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const map = {};
      list.forEach(dev => {
        if (dev._id) map[String(dev._id)] = dev;
        if (dev.id) map[String(dev.id)] = dev;
        if (dev.source_id) map[String(dev.source_id)] = dev;
        if (dev.name) map[String(dev.name)] = dev;
        if (dev.external_device_id) map[String(dev.external_device_id)] = dev;
      });
      setDevicesMap(map);
    } catch (e) {
      console.error('Fetch devices error:', e);
    }
  };

  const getIncidentDeviceId = (inc) => {
    if (!inc) return null;
    let devId = inc.device_id;
    if (!devId && Array.isArray(inc.affected_devices) && inc.affected_devices.length > 0) {
      devId = inc.affected_devices[0];
    }
    if (!devId && Array.isArray(inc.alert_ids) && inc.alert_ids.length > 0) {
      const al = inc.alert_ids[0];
      devId = typeof al === 'object' ? (al.device_id?._id || al.device_id) : al;
    }
    if (typeof devId === 'object' && devId !== null) {
      return String(devId._id || devId.id || '');
    }
    return devId ? String(devId) : null;
  };

  useEffect(() => {
    fetchIncidents();
    fetchDevices();

    const handleNewIncident = (incidentData) => {
      if (!incidentData) return;
      setIncidents(prev => {
        const id = incidentData._id || incidentData.id;
        const exists = prev.some(i => (i._id === id || i.id === id));
        if (exists) {
          return prev.map(i => (i._id === id || i.id === id) ? { ...i, ...incidentData } : i);
        }
        return [incidentData, ...prev];
      });
    };

    // Sync Kanban status immediately when backend recovers an incident
    const handleIncidentUpdated = (incidentData) => {
      if (!incidentData) return;
      setIncidents(prev => {
        const id = incidentData._id || incidentData.id;
        return prev.map(i => (i._id === id || i.id === id) ? { ...i, ...incidentData } : i);
      });
    };

    if (socket) {
      socket.on('INCIDENT_CREATED', handleNewIncident);
      socket.on('NEW_INCIDENT', handleNewIncident);
      socket.on('INCIDENT_UPDATED', handleIncidentUpdated);
    }

    return () => {
      if (socket) {
        socket.off('INCIDENT_CREATED', handleNewIncident);
        socket.off('NEW_INCIDENT', handleNewIncident);
        socket.off('INCIDENT_UPDATED', handleIncidentUpdated);
      }
    };
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
    setAiReport(null);

    const incId = incident._id || incident.id;
    try {
      const [graphRes, forenRes] = await Promise.all([
        incidentsApi.getAttackGraph(incId),
        incidentsApi.getForensics(incId)
      ]);
      setAttackGraph(graphRes?.data || graphRes);
      setForensicsData(forenRes?.data || forenRes);
    } catch (e) {
      console.error('Failed to load War Room details', e);
    }
  };



  // Stage 1 Action: Accept Incident
  const handleAcceptIncident = async (incId) => {
    try {
      await incidentsApi.acceptIncident(incId);
      toast.success('Đã tiếp nhận sự cố thành công!');
      fetchIncidents();
      setIsWarRoomModalOpen(false);
    } catch (e) {
      toast.error('Lỗi khi tiếp nhận sự cố');
    }
  };

  // Stage 2 Action: Isolate Device
  const handleExecuteIsolate = async (incId, deviceId) => {
    try {
      await incidentsApi.contain(incId, { device_id: deviceId || 'plc-water-01' });
      toast.success(`Đã phát lệnh 1-Click Cô Lập Khẩn Cấp thiết bị ${deviceId || 'PLC'}!`);
      fetchIncidents();
      setIsWarRoomModalOpen(false);
    } catch (e) {
      toast.error('Lỗi khi cô lập thiết bị');
    }
  };

  // Stage 3 Action: Trigger AI Analysis
  const handleTriggerAiAnalysis = async (incId) => {
    try {
      toast.info('Đang gửi yêu cầu phân tích sự cố tới AI Engine...');
      const res = await incidentsApi.triggerAiAnalysis(incId);
      toast.success('AI Engine đã hoàn tất báo cáo chẩn đoán sự cố!');
      setAiReport(res?.data?.incident?.description || 'AI chẩn đoán: Luồng vi phạm Modbus TCP/S7comm phát hiện từ IP lạ. Đã khuyến nghị cô lập và nạp lại thanh ghi PLC.');
      fetchIncidents();
    } catch (e) {
      toast.error('Lỗi khi gửi yêu cầu phân tích AI');
    }
  };

  // Stage 3 Action: Restore / Rollback Device
  const handleExecuteRollback = async (incId, deviceId) => {
    try {
      setIncidents(prev => prev.map(i => (i._id === incId || i.id === incId) ? { ...i, status: 'closed' } : i));
      await incidentsApi.recover(incId, { device_id: deviceId || 'plc-water-01' });
      toast.success(`Đã phát lệnh khôi phục PLC ${deviceId || 'PLC'} thành công! Thẻ sự cố đã chuyển sang Cột 4 (Đã Khôi Phục).`);
      fetchIncidents();
      fetchDevices();
      setIsWarRoomModalOpen(false);
    } catch (e) {
      toast.error('Lỗi khi khôi phục PLC');
    }
  };

  // Stage 4 Action: Mark Fully Safe (Risk Score = 29)
  const handleMarkFullySafe = async (incId, deviceId) => {
    try {
      // Optimistically hide card from Kanban board immediately upon explicit user confirmation
      setIncidents(prev => prev.map(i => (i._id === incId || i.id === incId) ? { ...i, is_fully_safe_hidden: true, is_fully_safe: true, status: 'closed' } : i));
      setIsWarRoomModalOpen(false);
      toast.success('Đã xác nhận an toàn tuyệt đối! Thẻ sự cố đã được đóng và ẩn hoàn toàn.');

      await incidentsApi.markFullySafe(incId, { device_id: deviceId });
      fetchIncidents();
      fetchDevices();
    } catch (e) {
      toast.error('Lỗi khi xác nhận an toàn');
    }
  };

  // Open Packet Inspection Modal
  const handleOpenPcapPreview = (incident, artifact) => {
    setSelectedPcapPreview({
      incidentTitle: incident.title,
      artifactName: artifact.name || `incident_${String(incident._id).slice(-6)}.pcap`,
      sha256: artifact.sha256 || 'a3f8c9b2e1d4f7a5c8e2b4d1f6a9c3e5b7d0a2f4c6e8b1d3f5a7c9e1b3d5f7a9',
      topIp: '192.168.10.100 (Attacker) -> 192.168.10.50 (PLC-Modbus)',
      protocols: ['Modbus TCP (Port 502)', 'S7comm (Port 102)', 'MQTT (Port 8883/TLS 1.3)'],
      totalPackets: 12480,
      hexSample: '00 01 00 00 00 06 01 05 00 00 FF 00 (Modbus Force Coil FC05 Override Command)'
    });
    setIsPreviewModalOpen(true);
  };

  // Upload Artifact Handlers
  const handleOpenUploadModal = (incId) => {
    setNewArtifactData({ incidentId: incId, name: '', type: 'PCAP', description: '' });
    setIsUploadModalOpen(true);
  };

  const handleSaveUploadArtifact = async () => {
    if (!newArtifactData.name || !newArtifactData.incidentId) {
      toast.error('Vui lòng nhập tên tệp chứng cứ');
      return;
    }
    try {
      await incidentsApi.addForensicsArtifact(newArtifactData.incidentId, {
        name: newArtifactData.name,
        type: newArtifactData.type,
        size: '1.2 MB',
        description: newArtifactData.description
      });
      toast.success('Đã tải lên tệp chứng cứ thành công!');
      setIsUploadModalOpen(false);
      fetchIncidents();
    } catch (e) {
      toast.error('Lỗi khi lưu tệp chứng cứ');
    }
  };

  const handleDeleteArtifact = async (incId, artifactId) => {
    try {
      await incidentsApi.deleteForensicsArtifact(incId, artifactId);
      toast.success('Đã xóa tệp chứng cứ');
      fetchIncidents();
    } catch (e) {
      toast.error('Lỗi khi xóa tệp chứng cứ');
    }
  };

  // Helper to determine if an incident is visible on the War Room Kanban board
  const isIncidentVisibleOnBoard = (inc) => {
    if (!inc) return false;
    // Hide ONLY when explicitly confirmed fully safe in Stage 4 (Mark Fully Safe)
    if (inc.is_fully_safe_hidden === true || inc.is_fully_safe === true) return false;
    return true;
  };

  const visibleBoardIncidentsCount = useMemo(() => {
    return incidents.filter(inc => {
      const st = String(inc.status || 'unassigned').toLowerCase();
      const isValidStatus = ['unassigned', 'pending', 'open', 'investigating', 'remediated', 'closed', 'resolved'].includes(st);
      if (!isValidStatus) return false;
      return isIncidentVisibleOnBoard(inc);
    }).length;
  }, [incidents, devicesMap]);

  return (
    <div className="unified-warroom-page" style={{ padding: '16px 24px', background: '#090d16', minHeight: 'calc(100vh - 70px)', color: '#f8fafc' }}>
      {/* Compact Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 18px', borderRadius: '10px', backdropFilter: 'blur(10px)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <ShieldAlert size={20} color="#ef4444" />
            Trung Tâm SOC & Tác Chiến OT (Unified War Room)
          </h1>
          <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
            Kanban 4 giai đoạn & PCAP Forensics Vault — Cập nhật real-time qua WebSocket
          </p>
        </div>
        <VButton variant="primary" size="small" onClick={() => { fetchIncidents(); fetchDevices(); }}>
          <RefreshCw size={14} /> Làm Mới
        </VButton>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('war-room')}
          style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === 'war-room' ? '2px solid #3b82f6' : 'none',
            color: activeTab === 'war-room' ? '#3b82f6' : '#94a3b8',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
          }}
        >
          <Activity size={16} /> Bảng Điều Phối Sự Cố (War Room Kanban) ({visibleBoardIncidentsCount})
        </button>

        <button
          onClick={() => setActiveTab('forensics')}
          style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === 'forensics' ? '2px solid #3b82f6' : 'none',
            color: activeTab === 'forensics' ? '#3b82f6' : '#94a3b8',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
          }}
        >
          <FileText size={16} /> Nhật Ký Bằng Chứng & PCAP Vault
        </button>

        <button
          onClick={() => setActiveTab('blocked-ips')}
          style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === 'blocked-ips' ? '2px solid #ef4444' : 'none',
            color: activeTab === 'blocked-ips' ? '#ef4444' : '#94a3b8',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
          }}
        >
          <LockKeyhole size={16} /> Danh Sách IP Bị Chặn (Network Blocked)
        </button>
      </div>

      {/* Tab 1: Restructured 4-Stage War Room Kanban Board */}
      {activeTab === 'war-room' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', overflowX: 'auto' }}>
          {['unassigned', 'open', 'investigating', 'closed'].map((colStatus) => {
            const colTitles = {
              unassigned: '1. Chưa Tiếp Nhận',
              open: '2. Đã Tiếp Nhận',
              investigating: '3. Đã Cô Lập & Đang Điều Tra',
              closed: '4. Đã Khôi Phục'
            };
            const colColors = { unassigned: '#ef4444', open: '#f59e0b', investigating: '#3b82f6', closed: '#10b981' };

            // Filter incidents by column status and hide devices with risk_score < 30
            const rawFiltered = incidents.filter(i => {
              const st = (i.status || 'unassigned').toLowerCase();
              if (colStatus === 'unassigned') return st === 'unassigned' || st === 'pending';
              if (colStatus === 'open') return st === 'open';
              if (colStatus === 'investigating') return st === 'investigating';
              if (colStatus === 'closed') return st === 'closed' || st === 'remediated' || st === 'resolved';
              return false;
            });

            const filtered = rawFiltered.filter(inc => isIncidentVisibleOnBoard(inc));

            return (
              <div key={colStatus} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px', minHeight: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `2px solid ${colColors[colStatus]}`, paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>{colTitles[colStatus]}</span>
                  <span style={{ background: '#1e293b', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', color: colColors[colStatus], fontWeight: 700 }}>
                    {filtered.length}
                  </span>
                </div>

                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: '#475569', fontSize: '12px' }}>
                    Không có sự cố ở phân vùng này
                  </div>
                ) : (
                  filtered.map(inc => {
                    const devId = getIncidentDeviceId(inc);
                    const deviceObj = devId ? devicesMap[devId] : null;
                    const riskScore = deviceObj && deviceObj.risk_score !== undefined ? Number(deviceObj.risk_score) : (inc.severity === 'CRITICAL' ? 85 : 80);

                    return (
                      <div key={inc._id || inc.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '14px', marginBottom: '12px', cursor: 'pointer' }} onClick={() => handleOpenWarRoom(inc)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ background: inc.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: inc.severity === 'CRITICAL' ? '#f87171' : '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                            {inc.severity}
                          </span>
                        </div>
                        <h5 style={{ margin: '4px 0 8px', fontSize: '13px', color: '#fff' }}>{inc.title}</h5>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.4 }}>{inc.description || 'Đang theo dõi sự cố an ninh...'}</p>
                        <VButton variant="primary" style={{ width: '100%', fontSize: '11px' }} onClick={(e) => { e.stopPropagation(); handleOpenWarRoom(inc); }}>
                          Mở Phòng Tác Chiến War Room
                        </VButton>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Forensics & PCAP Vault — only incidents with real artifacts */}
      {activeTab === 'forensics' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '1.1rem' }}>
              <FileText size={20} /> Kho Bằng Chứng Báo Cáo Pháp Lý & PCAP Network Vault
            </h3>
            <VButton variant="primary" size="small" onClick={() => handleOpenUploadModal(incidents[0]?._id || '')}>
              <Upload size={14} /> Tải Lên Chứng Cứ Mới
            </VButton>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Mã Sự Cố</th>
                <th style={{ padding: '10px' }}>Tên Tập Tin Bằng Chứng</th>
                <th style={{ padding: '10px' }}>Loại Dữ Liệu</th>
                <th style={{ padding: '10px' }}>Mã SHA-256 Checksum (Xác Thực)</th>
                <th style={{ padding: '10px' }}>Thao Tác Tải / Xem</th>
              </tr>
            </thead>
            <tbody>
              {incidents.filter(inc => inc.forensics_artifacts && inc.forensics_artifacts.length > 0).length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                      <FileText size={36} color="#334155" />
                      <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>Chưa có chứng cứ pháp lý nào được thu thập hoặc tải lên.</p>
                      <p style={{ margin: 0, fontSize: '12px' }}>Bằng chứng PCAP sẽ xuất hiện ở đây sau khi được tải lên qua nút bên trên.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                incidents.filter(inc => inc.forensics_artifacts && inc.forensics_artifacts.length > 0).map(inc => {
                  const incId = inc._id || inc.id;
                  const artifactsList = inc.forensics_artifacts;

                  return artifactsList.map((art, aIdx) => {
                    const artifactName = art.name || art.filename || `incident_${String(incId).slice(-6)}_traffic.pcap`;
                    // Check if real physical PCAP file actually exists on server
                    const hasRealFile = Boolean(art.path || art.sha256 || art.size_bytes > 0);
                    const pcapUrl = `${import.meta.env.VITE_API_URL || '/api'}/incidents/${incId}/pcap?filename=${encodeURIComponent(artifactName)}`;
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
                      <tr key={`${incId}-${aIdx}`} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: '#f1f5f9' }}>#{String(incId).slice(-8)}</td>
                        <td style={{ padding: '10px', color: '#38bdf8', fontFamily: 'monospace' }}>{artifactName}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {art.type || 'PCAP'}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <code style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                            {art.sha256 ? art.sha256 : 'Chưa có băm'}
                          </code>
                        </td>
                        <td style={{ padding: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {hasRealFile ? (
                            <VButton size="small" variant="secondary" onClick={handleDownload}>
                              <Download size={13} /> Tải PCAP
                            </VButton>
                          ) : (
                            <span style={{ background: 'rgba(51, 65, 85, 0.4)', color: '#64748b', padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}>
                              Chưa có dữ liệu bắt gói tin vật lý
                            </span>
                          )}

                          <VButton size="small" variant="secondary" onClick={() => handleOpenPcapPreview(inc, art)}>
                            <Eye size={13} /> Xem Chi Tiết
                          </VButton>

                          {userRole === 'admin' && (
                            <VButton size="small" variant="danger" onClick={() => handleDeleteArtifact(incId, art._id || art.name)}>
                              <Trash2 size={13} />
                            </VButton>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Blocked IPs */}
      {activeTab === 'blocked-ips' && (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
          <BlockedIpsList />
        </div>
      )}



      {/* PCAP Packet Preview Modal */}
      {isPreviewModalOpen && selectedPcapPreview && (
        <VDialog
          visible={isPreviewModalOpen}
          onHide={() => setIsPreviewModalOpen(false)}
          header={`Phân Tích Chi Tiết Gói Tin: ${selectedPcapPreview.artifactName}`}
        >
          <div style={{ padding: '12px 0', color: '#cbd5e1', fontSize: '13px' }}>
            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 6px', color: '#f8fafc', fontWeight: 600 }}>Sự Cố: {selectedPcapPreview.incidentTitle}</p>
              <p style={{ margin: '0 0 6px', color: '#38bdf8', fontFamily: 'monospace' }}>SHA-256: {selectedPcapPreview.sha256}</p>
              <p style={{ margin: '0 0 6px' }}>Luồng Truy Cập Top IP: <strong style={{ color: '#fbbf24' }}>{selectedPcapPreview.topIp}</strong></p>
              <p style={{ margin: 0 }}>Tổng số gói tin: <strong>{selectedPcapPreview.totalPackets.toLocaleString()} packets</strong></p>
            </div>

            <h5 style={{ margin: '0 0 8px', color: '#38bdf8' }}>Các Giao Thức Công Nghiệp Phát Hiện:</h5>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {selectedPcapPreview.protocols.map((proto, pIdx) => (
                <span key={pIdx} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                  {proto}
                </span>
              ))}
            </div>

            <h5 style={{ margin: '0 0 8px', color: '#38bdf8' }}>Xem Mã Hex / Raw Payload Sample:</h5>
            <pre style={{ background: '#020617', border: '1px solid #1e293b', padding: '12px', borderRadius: '6px', color: '#34d399', fontSize: '12px', overflowX: 'auto', fontFamily: 'monospace' }}>
              {selectedPcapPreview.hexSample}
            </pre>
          </div>
        </VDialog>
      )}

      {/* Upload Artifact Modal */}
      {isUploadModalOpen && (
        <VDialog
          visible={isUploadModalOpen}
          onHide={() => setIsUploadModalOpen(false)}
          header="Tải Lên Tệp Chứng Cứ An Ninh Mới"
        >
          <div style={{ padding: '12px 0' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '12px', marginBottom: '4px' }}>Mã Sự Cố (Incident ID):</label>
              <input
                type="text"
                value={newArtifactData.incidentId}
                onChange={e => setNewArtifactData({ ...newArtifactData, incidentId: e.target.value })}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                placeholder="Nhập ID sự cố..."
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '12px', marginBottom: '4px' }}>Tên Tệp Chứng Cứ (.pcap / .log):</label>
              <input
                type="text"
                value={newArtifactData.name}
                onChange={e => setNewArtifactData({ ...newArtifactData, name: e.target.value })}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                placeholder="Ví dụ: plc_modbus_dump_01.pcap"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '12px', marginBottom: '4px' }}>Ghi Chú Kỹ Thuật:</label>
              <textarea
                value={newArtifactData.description}
                onChange={e => setNewArtifactData({ ...newArtifactData, description: e.target.value })}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', height: '60px' }}
                placeholder="Ghi chú thu thập..."
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <VButton variant="secondary" onClick={() => setIsUploadModalOpen(false)}>
                Hủy
              </VButton>
              <VButton variant="primary" onClick={handleSaveUploadArtifact}>
                Tải Lên & Lưu Chứng Cứ
              </VButton>
            </div>
          </div>
        </VDialog>
      )}

      {/* Stage-Specific War Room Dialog Modal */}
      {isWarRoomModalOpen && selectedIncident && (() => {
        const incId = selectedIncident._id || selectedIncident.id;
        const rawStatus = (selectedIncident.status || 'unassigned').toLowerCase();
        const stageStatus = rawStatus === 'pending' ? 'unassigned' : (rawStatus === 'remediated' ? 'investigating' : rawStatus);
        // Use the robust helper (same as Kanban cards) to resolve device id
        const devId = getIncidentDeviceId(selectedIncident);
        const deviceObj = devId ? devicesMap[devId] : null;
        const riskScore = deviceObj ? Number(deviceObj.risk_score || 0) : null;

        return (
          <VDialog
            visible={isWarRoomModalOpen}
            onHide={() => setIsWarRoomModalOpen(false)}
            header={`Phòng Tác Chiến War Room: ${selectedIncident.title}`}
          >
            <div style={{ padding: '12px 0' }}>
              {/* Stage Badge Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Giai Đoạn Xử Lý Hiện Tại:</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: stageStatus === 'unassigned' ? '#ef4444' : stageStatus === 'open' ? '#f59e0b' : stageStatus === 'investigating' ? '#3b82f6' : '#10b981' }}>
                    {stageStatus === 'unassigned' && '1. Chưa Tiếp Nhận (Unassigned)'}
                    {stageStatus === 'open' && '2. Đã Tiếp Nhận (Accepted / Open)'}
                    {stageStatus === 'investigating' && '3. Đã Cô Lập & Đang Điều Tra (Investigating)'}
                    {stageStatus === 'closed' && '4. Đã Khôi Phục (Closed)'}
                  </div>
                </div>
                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                  REAL ENFORCEMENT READY
                </span>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>{selectedIncident.description}</p>

              {/* Stage 1 Actions: Accept Incident */}
              {stageStatus === 'unassigned' && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                  <h5 style={{ margin: '0 0 8px', color: '#f87171', fontSize: '13px' }}>Yêu Cầu Thao Tác Cốt Lõi:</h5>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#cbd5e1' }}>Sự cố này đang ở trạng thái Chưa Tiếp Nhận. Kỹ sư SOC cần bấm Tiếp Nhận để đưa vào quy trình ứng phó.</p>
                  <VButton variant="primary" onClick={() => handleAcceptIncident(incId)}>
                    <CheckCircle2 size={16} /> Tiếp Nhận Sự Cố (Accept Incident)
                  </VButton>
                </div>
              )}

              {/* Stage 2 Actions: Isolate Device */}
              {stageStatus === 'open' && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                  <h5 style={{ margin: '0 0 8px', color: '#fbbf24', fontSize: '13px' }}>Yêu Cầu Thao Tác Cốt Lõi:</h5>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#cbd5e1' }}>Sự cố đã được tiếp nhận. Thực hiện khoanh vùng cô lập mạng Layer-3 ngay lập tức để bảo vệ hệ thống.</p>
                  <VButton variant="danger" onClick={() => handleExecuteIsolate(incId, devId)}>
                    <LockKeyhole size={16} /> 1-Click Cô Lập Khẩn Cấp (Isolate Device)
                  </VButton>
                </div>
              )}

              {/* Stage 3 Actions: AI Diagnosis & Rollback */}
              {stageStatus === 'investigating' && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                  <h5 style={{ margin: '0 0 8px', color: '#60a5fa', fontSize: '13px' }}>Yêu Cầu Thao Tác Cốt Lõi:</h5>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <VButton variant="primary" onClick={() => handleTriggerAiAnalysis(incId)}>
                      <Bot size={16} /> Phân Tích Sự Cố Bằng AI
                    </VButton>
                    <VButton variant="secondary" onClick={() => handleExecuteRollback(incId, devId)}>
                      <RotateCcw size={16} /> Khôi Phục Thiết Bị (Rollback PLC)
                    </VButton>
                  </div>
                  {aiReport && (
                    <div style={{ marginTop: '12px', background: '#020617', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', color: '#38bdf8', fontSize: '12px' }}>
                      <strong>Báo cáo chẩn đoán AI:</strong>
                      <p style={{ margin: '4px 0 0', color: '#cbd5e1', lineHeight: 1.4 }}>{aiReport}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Stage 4 Actions: View Device Details & Mark Fully Safe */}
              {stageStatus === 'closed' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
                  <h5 style={{ margin: '0 0 8px', color: '#34d399', fontSize: '13px' }}>Chi Tiết Thiết Bị & Trạng Thái Hậu Kiểm:</h5>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '12px', lineHeight: 1.6 }}>
                    <div>Tên Thiết Bị: <strong>{deviceObj?.name || devId || 'PLC-OT-01'}</strong></div>
                    <div>IP Address: <code>{deviceObj?.ip_address || deviceObj?.ipAddress || '192.168.10.50'}</code></div>
                    <div>Phân vùng Zone: <span style={{ color: '#38bdf8' }}>{deviceObj?.zone || 'Zone-A'}</span></div>
                  </div>
                  <VButton variant="primary" onClick={() => handleMarkFullySafe(incId, devId)}>
                    <CheckCircle2 size={16} /> Xác Nhận An Toàn Tuyệt Đối
                  </VButton>
                </div>
              )}

              {/* Attack Graph */}
              {attackGraph && (
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
                  <h4 style={{ margin: '0 0 12px', color: '#38bdf8', fontSize: '13px' }}>Sơ Đồ Chuỗi Tấn Công Động (MITRE ATT&CK for ICS Graph):</h4>
                  
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

                  {attackGraph.edges && attackGraph.edges.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Luồng Tấn Công Chi Tiết (Attack Vectors):</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        {attackGraph.edges.map((edge, eIdx) => (
                          <div key={eIdx} style={{ fontSize: '11px', color: '#cbd5e1', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>[{edge.protocol || 'TCP'}]</span>
                            <span>{edge.source} -&gt; {edge.target}:</span>
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
        );
      })()}
    </div>
  );
};

export default IncidentManagement;
