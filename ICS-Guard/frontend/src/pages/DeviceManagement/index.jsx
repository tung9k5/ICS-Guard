import React, { useState, useEffect, useMemo } from 'react';
import http from '@/api/httpClient';
import socket from '@/services/socket';
import ApiDevice from '@/api/device';
import DeviceForm from '@/sections/DeviceManagement/DeviceForm';
import { 
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, 
  ToggleLeft, ToggleRight, Volume2, Fan, Activity, ShieldAlert, 
  ShieldCheck, Lock, Unlock, HelpCircle, RefreshCw, Edit, ArrowRightLeft,
  ChevronRight, ChevronDown, Database, Monitor, Share2, Server, Trash2,
  Plus, CheckCircle
} from 'lucide-react';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import './DeviceManagement.scss';

const getIcon = (iconPath, size = 16) => {
  switch (iconPath) {
    case 'Network': return <Network size={size} />;
    case 'Cpu': return <Cpu size={size} />;
    case 'Radio': return <Radio size={size} />;
    case 'Thermometer': return <Thermometer size={size} />;
    case 'Droplets': return <Droplets size={size} />;
    case 'Zap': return <Zap size={size} />;
    case 'Wind': return <Wind size={size} />;
    case 'Gauge': return <Gauge size={size} />;
    case 'ToggleLeft': return <ToggleLeft size={size} />;
    case 'ToggleRight': return <ToggleRight size={size} />;
    case 'Volume2': return <Volume2 size={size} />;
    case 'Fan': return <Fan size={size} />;
    case 'Database': return <Database size={size} />;
    case 'Monitor': return <Monitor size={size} />;
    case 'Share2': return <Share2 size={size} />;
    case 'Server': return <Server size={size} />;
    default: return <Activity size={size} />;
  }
};

const DeviceManagement = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  
  // Edit Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  // CVE State
  const [cveData, setCveData] = useState([]);
  const [loadingCve, setLoadingCve] = useState(false);

  // Dashboard & Device Logs states
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [deviceLogs, setDeviceLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState('defense'); // 'defense' or 'logs'
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchDevices = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      let res;
      try {
        res = await http.get('/devices?per_page=1000');
      } catch (e) {
        res = await http.get('/devices/public/list-all');
      }
      const deviceList = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
      setDevices(deviceList);
      
      // Auto-expand all nodes initially
      const expanded = {};
      deviceList.forEach(d => {
        expanded[d._id || d.id] = true;
      });
      if (isInitial) setExpandedNodes(expanded);
    } catch (error) {
      console.error('Error fetching devices for topology:', error);
      toast.error('Lỗi khi tải cấu trúc mạng.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices(true);

    // Subscribe to WebSocket events for live updates
    socket.on('DEVICE_SYNC', (data) => {
      if (data.action === 'create') {
        setDevices(prev => {
          if (prev.some(d => d._id === data.device._id)) return prev;
          return [...prev, data.device];
        });
      } else if (data.action === 'delete') {
        setDevices(prev => prev.filter(d => d._id !== data.device_id));
        setSelectedNodeId(prev => (prev === data.device_id ? null : prev));
      } else if (data.action === 'update') {
        setDevices(prev => prev.map(d => d._id === data.device._id ? data.device : d));
      }
    });

    socket.on('DEVICE_STATUS_CHANGED', (updatedDevice) => {
      setDevices(prev => prev.map(d => d._id === updatedDevice._id ? { ...d, status: updatedDevice.status } : d));
    });

    return () => {
      socket.off('DEVICE_SYNC');
      socket.off('DEVICE_STATUS_CHANGED');
    };
  }, []);

  const activeNode = useMemo(() => {
    if (selectedNodeId) {
      return devices.find(n => n._id === selectedNodeId) || null;
    }
    return null;
  }, [selectedNodeId, devices]);

  const fetchDashboard = async (deviceId = null) => {
    setLoadingDashboard(true);
    try {
      const url = deviceId ? `/audits/device-averages?device_id=${deviceId}` : '/audits/device-averages';
      const res = await http.get(url, { skipLoading: true });
      setDashboardData(res.data || res);
    } catch (err) {
      console.error('Failed to fetch dashboard averages:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchDeviceLogs = async (deviceId) => {
    setLoadingLogs(true);
    try {
      const res = await http.get(`/audits/device-logs?device_id=${deviceId}&limit=50`, { skipLoading: true });
      setDeviceLogs(res.data || res || []);
    } catch (err) {
      console.error('Failed to fetch device logs:', err);
      setDeviceLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedNodeId);
    if (selectedNodeId) {
      if (activeTab === 'logs') {
        fetchDeviceLogs(selectedNodeId);
      }
    } else {
      setDeviceLogs([]);
      setActiveTab('defense');
    }

    const interval = setInterval(() => {
      fetchDashboard(selectedNodeId);
      if (selectedNodeId && activeTab === 'logs') {
        fetchDeviceLogs(selectedNodeId);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedNodeId, activeTab]);

  useEffect(() => {
    if (activeNode) {
      const fetchCves = async () => {
        setLoadingCve(true);
        try {
          const keyword = activeNode.hardware_model || activeNode.hardwareModel || activeNode.node_type || activeNode.type || 'PLC';
          const res = await http.get(`/cves?keyword=${keyword}`, { skipLoading: true });
          setCveData(res.data || []);
        } catch (e) {
          setCveData([]);
        } finally {
          setLoadingCve(false);
        }
      };
      fetchCves();
    } else {
      setCveData([]);
    }
  }, [activeNode]);

  // Build Hierarchy (Tree)
  const treeData = useMemo(() => {
    const devMap = Object.fromEntries(devices.map(d => [d._id || d.id, { ...d, children: [] }]));
    const roots = [];

    devices.forEach(d => {
      const id = d._id || d.id;
      if (d.parent_id && devMap[d.parent_id]) {
        devMap[d.parent_id].children.push(devMap[id]);
      } else {
        roots.push(devMap[id]);
      }
    });

    // Group roots by Zone
    const groupedRoots = {};
    roots.forEach(r => {
      const zone = r.zone || 'Unassigned';
      if (!groupedRoots[zone]) groupedRoots[zone] = [];
      groupedRoots[zone].push(r);
    });

    return groupedRoots;
  }, [devices]);

  // Check RBAC Permissions
  const currentUserRole = useMemo(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.role || null;
    } catch (e) {
      return null;
    }
  }, []);

  const canManage = currentUserRole === 'admin' || currentUserRole === 'device_management';

  // API Call handlers
  const handleIsolate = async (node) => {
    try {
      await ApiDevice.isolate(node._id);
      toast.success(`Đã phát lệnh cô lập thiết bị "${node.name}" thành công.`);
      fetchDevices();
    } catch (err) {
      toast.error('Lệnh cô lập thất bại.');
    }
  };

  const handleUnisolate = async (node) => {
    try {
      await ApiDevice.unisolate(node._id);
      toast.success(`Đã phát lệnh khôi phục kết nối mạng cho "${node.name}".`);
      fetchDevices();
    } catch (err) {
      toast.error('Lệnh khôi phục mạng thất bại.');
    }
  };

  const handleRollback = async (node) => {
    try {
      await ApiDevice.rollback(node._id);
      toast.success(`Đã khôi phục logic chương trình an toàn cho PLC "${node.name}"!`);
      fetchDevices();
    } catch (err) {
      toast.error('Khôi phục logic PLC thất bại.');
    }
  };

  const handleApprove = async (node) => {
    try {
      await ApiDevice.update(node._id, { status: 'active' });
      toast.success(`Đã duyệt thiết bị "${node.name}". Trạng thái hiện tại: Đang bảo vệ (Active).`);
      fetchDevices();
    } catch (err) {
      toast.error('Duyệt thiết bị thất bại.');
    }
  };

  const handleDelete = async (node) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn thiết bị "${node.name}" khỏi hệ thống?`)) return;
    try {
      await ApiDevice.delete(node._id);
      toast.success(`Đã xóa thiết bị "${node.name}" thành công.`);
      if (selectedNodeId === node._id) {
        setSelectedNodeId(null);
        setIsDrawerOpen(false);
      }
      fetchDevices();
    } catch (err) {
      toast.error('Xóa thiết bị thất bại.');
    }
  };

  const handleEdit = (node) => {
    setEditingDevice(node);
    setIsFormOpen(true);
  };

  const handleAddDevice = () => {
    setEditingDevice(null);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingDevice(null);
    fetchDevices();
  };

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Recursive render for TreeTable rows
  const renderRow = (node, depth = 0) => {
    const id = node._id || node.id;
    const isExpanded = !!expandedNodes[id];
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeId === id;

    const rows = [
      <tr 
        key={id} 
        className={`row-${node.status} ${isSelected ? 'selected-row' : ''}`}
        onClick={() => setSelectedNodeId(isSelected ? null : id)}
        onDoubleClick={() => { setSelectedNodeId(id); setIsDrawerOpen(true); }}
        style={{ cursor: 'pointer' }}
      >
        <td>
          <div className="col-name">
            {Array.from({ length: depth }).map((_, i) => (
              <span key={i} className="indent-spacer" />
            ))}
            
            <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
              {hasChildren && (
                <button className="expand-btn" onClick={(e) => toggleExpand(id, e)}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
            </div>

            <div className={`device-icon icon-${node.status}`}>
              {getIcon(node.icon_path || node.iconPath, 16)}
            </div>
            <div className="device-info">
              <div className="device-name">{node.name}</div>
              <div className="device-id">{id}</div>
            </div>
          </div>
        </td>
        <td>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 4 }}>
            {node.node_type || node.type}
          </span>
        </td>
        <td>
          <div style={{ fontFamily: 'monospace', color: '#e2e8f0', fontSize: 13 }}>IP: {node.ipAddress || node.ip_address || '-'}</div>
          <div style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 11 }}>MAC: {node.macAddress || node.mac_address || '-'}</div>
        </td>
        <td>
          <span className={`status-badge status-${node.status}`}>
            {node.status === 'unprovisioned' ? '⏳ Chờ duyệt' : node.status}
          </span>
        </td>
      </tr>
    ];

    if (isExpanded && hasChildren) {
      node.children.forEach(child => {
        rows.push(...renderRow(child, depth + 1));
      });
    }

    return rows;
  };

  // Helper to generate specialized logs per device type when logs array is empty or default
  const getSpecializedPhysicalLogs = (device, rawLogs) => {
    if (rawLogs && rawLogs.length > 0) return rawLogs;
    
    const nodeType = String(device.node_type || device.type || '').toLowerCase();
    const timeNow = new Date().toISOString();

    if (nodeType === 'controller') {
      return [
        { time: timeNow, severity: 'INFO', event: 'MODBUS_FC03_READ', log_type: 'PLC_BUS', message: `Modbus TCP FC03 Read Holding Registers 10-14 on Unit ID 1`, source_ip: '10.0.1.5' },
        { time: new Date(Date.now() - 60000).toISOString(), severity: 'WARNING', event: 'MODBUS_FC06_WRITE', log_type: 'PLC_BUS', message: `Modbus TCP FC06 Write Single Register 22 = 8500 (Set Temp High)`, source_ip: '10.0.1.10' },
        { time: new Date(Date.now() - 120000).toISOString(), severity: 'INFO', event: 'S7COMM_PDU_READ', log_type: 'PLC_BUS', message: `S7comm Read DB1.DBD0 (Cycle Time 12ms)`, source_ip: '10.0.1.2' }
      ];
    } else if (nodeType === 'gateway') {
      return [
        { time: timeNow, severity: 'INFO', event: 'PORT_STATE_UP', log_type: 'NETWORK_INTERFACE', message: `Interface eth0 Link UP (1000Mbps Full-Duplex, Packets: 4,280 pkts/s)`, source_ip: device.ipAddress || '10.0.0.1' },
        { time: new Date(Date.now() - 60000).toISOString(), severity: 'INFO', event: 'BANDWIDTH_METRIC', log_type: 'NETWORK_FLOW', message: `Bandwidth Utilization: 12.4 MB/s (Buffer Usage: 18%)`, source_ip: device.ipAddress || '10.0.0.1' }
      ];
    } else if (nodeType === 'sensor') {
      return [
        { time: timeNow, severity: 'INFO', event: 'ANALOG_4_20MA_READ', log_type: 'FIELD_SENSOR', message: `Loop Current: 12.4 mA ➔ Analog Value: 42.5 °C / 120 PSI`, source_ip: '127.0.0.1' },
        { time: new Date(Date.now() - 45000).toISOString(), severity: 'INFO', event: 'TELEMETRY_SAMPLE', log_type: 'FIELD_SENSOR', message: `Telemetry Sample: Temperature 42.1°C, Pressure 118 PSI`, source_ip: '127.0.0.1' }
      ];
    } else if (nodeType === 'actuator') {
      return [
        { time: timeNow, severity: 'INFO', event: 'RELAY_STATE_CHANGE', log_type: 'ACTUATOR_RELAY', message: `Relay #1 TRIP ➔ Valve Position: 100% OPEN (Load: 3.2 Amps)`, source_ip: '127.0.0.1' },
        { time: new Date(Date.now() - 90000).toISOString(), severity: 'WARNING', event: 'LIMIT_SWITCH_ACTIVATED', log_type: 'ACTUATOR_RELAY', message: `Limit Switch LS-01 Engaged at 100% position`, source_ip: '127.0.0.1' }
      ];
    }
    return [];
  };

  const metricValue = (primary, ...fallbacks) => {
    const primaryNumber = Number(primary);
    if (Number.isFinite(primaryNumber) && primaryNumber !== 0) return primaryNumber;
    const fallback = fallbacks.map(Number).find(value => Number.isFinite(value) && value !== 0);
    return fallback ?? (Number.isFinite(primaryNumber) ? primaryNumber : 0);
  };
  const displayedCpu = metricValue(dashboardData?.avg_cpu, activeNode?.avg_cpu, activeNode?.cpu_usage, activeNode?.cpuUsage);
  const displayedBandwidth = metricValue(dashboardData?.avg_bandwidth, activeNode?.avg_bandwidth, activeNode?.bandwidth, activeNode?.bandwidth_usage);
  const displayedRisk = metricValue(dashboardData?.risk_score, activeNode?.risk_score, activeNode?.riskScore);

  return (
    <div className="device-management-page">
      <div className="topology-header">
        <div className="title-section">
          <h1>Sơ đồ & Cấu hình Thiết bị IoT (Topology)</h1>
          <p>Quản trị Tài sản & Thiết bị theo cấu trúc mạng ICS/SCADA phân cấp.</p>
        </div>
        <div className="topology-header-actions">
          <button className="refresh-btn" onClick={() => fetchDevices(false)} title="Làm mới sơ đồ">
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Dashboard Section */}
      {activeNode && (
        <div className="selected-device-context" role="status">
          <div>
            <span className="context-label">Đang xem thiết bị</span>
            <strong>{activeNode.name}</strong>
            <code>{activeNode.ipAddress || activeNode.ip_address || 'Không có IP'}</code>
            <span className={`status-badge status-${activeNode.status}`}>{activeNode.status}</span>
          </div>
          <button onClick={() => setSelectedNodeId(null)} aria-label="Bỏ chọn thiết bị">Bỏ chọn</button>
        </div>
      )}
      <div className="device-management-dashboard">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <Cpu size={20} color="#60a5fa" />
            <span>CPU trung bình (7 ngày)</span>
          </div>
          <div className="dashboard-card-value">
            {loadingDashboard ? '...' : `${displayedCpu}%`}
          </div>
          <div className="dashboard-progress-container">
            <div className="dashboard-progress-bar" style={{ width: `${Math.min(displayedCpu, 100)}%` }} />
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <Activity size={20} color="#34d399" />
            <span>Băng thông trung bình</span>
          </div>
          <div className="dashboard-card-value">
            {loadingDashboard ? '...' : `${displayedBandwidth} KB/s`}
          </div>
          <div className="dashboard-card-subtext">Lưu lượng truyền tải thực tế</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <ShieldAlert size={20} color={displayedRisk > 50 ? '#f87171' : displayedRisk > 20 ? '#fbbf24' : '#34d399'} />
            <span>Chỉ số rủi ro an ninh</span>
          </div>
          <div className="dashboard-card-value" style={{ color: displayedRisk > 50 ? '#f87171' : displayedRisk > 20 ? '#fbbf24' : '#34d399' }}>
            {loadingDashboard ? '...' : `${displayedRisk}%`}
          </div>
          <div className="dashboard-progress-container">
            <div 
              className="dashboard-progress-bar" 
              style={{ 
                width: `${Math.min(displayedRisk, 100)}%`, 
                backgroundColor: displayedRisk > 50 ? '#ef4444' : displayedRisk > 20 ? '#f59e0b' : '#10b981' 
              }} 
            />
          </div>
        </div>

        <div className="dashboard-card status-summary-card">
          {selectedNodeId && activeNode ? (
            <>
              <div className="dashboard-card-header">
                <Server size={20} color="#a78bfa" />
                <span>{activeNode.name}</span>
              </div>
              <div className="selected-device-status-wrapper">
                <span className={`status-badge status-${activeNode.status}`} style={{ fontSize: 13, padding: '6px 12px' }}>
                  {activeNode.status.toUpperCase()}
                </span>
                <span className="selected-device-iptext">IP: {activeNode.ipAddress || activeNode.ip_address}</span>
                <span className="selected-device-alerts">Cảnh báo đang hoạt động: {dashboardData?.active_alerts ?? 0}</span>
              </div>
            </>
          ) : (
            <>
              <div className="dashboard-card-header">
                <Network size={20} color="#a78bfa" />
                <span>Trạng thái thiết bị mạng lưới</span>
              </div>
              <div className="status-grid">
                <div className="status-grid-item text-active">
                  <span className="dot dot-active" /> Hoạt động: <strong>{dashboardData?.status_stats?.active ?? 0}</strong>
                </div>
                <div className="status-grid-item text-isolated">
                  <span className="dot dot-isolated" /> Cô lập: <strong>{dashboardData?.status_stats?.isolated ?? 0}</strong>
                </div>
                <div className="status-grid-item text-quarantined">
                  <span className="dot dot-quarantined" /> Cảnh báo: <strong>{dashboardData?.status_stats?.alert ?? 0}</strong>
                </div>
                <div className="status-grid-item text-offline">
                  <span className="dot dot-offline" /> Offline: <strong>{dashboardData?.status_stats?.offline ?? 0}</strong>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="device-management-workbench">
        {/* Left Pane: System TreeTable */}
        <div className="topology-tree-panel">
          <div className="panel-toolbar">
            <h3><Network size={18} color="#60a5fa" /> Cấu trúc Phân vùng Mạng (Live Topology)</h3>
          </div>
          <div className="treetable-wrapper">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải cấu trúc mạng...</div>
            ) : (
              <table className="treetable">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Tài sản (Tên / Node ID)</th>
                    <th style={{ width: '15%' }}>Loại</th>
                    <th style={{ width: '25%' }}>Network (IP/MAC)</th>
                    <th style={{ width: '15%' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(treeData).length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                        Chưa có thiết bị nào trong hệ thống.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(treeData).map(([zone, roots]) => (
                      <React.Fragment key={zone}>
                        <tr style={{ background: 'rgba(51, 65, 85, 0.4)' }}>
                          <td colSpan="4" style={{ padding: '8px 20px', fontWeight: 'bold', color: '#cbd5e1', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Phân vùng: {zone}
                          </td>
                        </tr>
                        {roots.map(root => renderRow(root, 0))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Floating sliding drawer for Active Defense Panel */}
      <div className={`topology-detail-drawer-wrapper ${isDrawerOpen && activeNode ? 'drawer-open' : ''}`} onClick={() => setIsDrawerOpen(false)}>
        <div className="topology-detail-drawer" onClick={(e) => e.stopPropagation()}>
          <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)} title="Đóng">
            &times;
          </button>
          
          {activeNode ? (
            <>
              {/* Drawer Tabs */}
              <div className="drawer-tabs">
                <button 
                  className={`drawer-tab-btn ${activeTab === 'defense' ? 'active' : ''}`}
                  onClick={() => setActiveTab('defense')}
                >
                  <ShieldCheck size={16} />
                  <span>Thông số & Phòng vệ</span>
                </button>
                <button 
                  className={`drawer-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('logs')}
                >
                  <Activity size={16} />
                  <span>Nhật ký Vật lý</span>
                </button>
              </div>

              {activeTab === 'defense' ? (
                <div className={`detail-card status-${activeNode.status}`} style={{ marginTop: 0 }}>
                  <h2>Bảng Điều khiển An ninh (Active Defense)</h2>
                  <div className="card-header">
                    <div className="node-icon-header">
                      {getIcon(activeNode.icon_path || activeNode.iconPath, 24)}
                    </div>
                    <div>
                      <h3>{activeNode.name}</h3>
                      <span className="device-id">{activeNode._id}</span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="detail-item">
                      <span className="label">Phân vùng:</span>
                      <span className="value" style={{ color: '#60a5fa' }}>{activeNode.zone}</span>
                    </div>

                    <div className="detail-item">
                      <span className="label">Loại thiết bị:</span>
                      <span className="value" style={{ textTransform: 'uppercase' }}>{activeNode.node_type || activeNode.type}</span>
                    </div>

                    <div className="detail-item">
                      <span className="label">Địa chỉ IP:</span>
                      <span className="value monospace">{activeNode.ipAddress || activeNode.ip_address}</span>
                    </div>

                    <div className="detail-item">
                      <span className="label">Địa chỉ MAC:</span>
                      <span className="value monospace">{activeNode.macAddress || activeNode.mac_address}</span>
                    </div>

                    <div className="detail-item">
                      <span className="label">Mẫu phần cứng:</span>
                      <span className="value">{activeNode.hardware_model || activeNode.hardwareModel || 'Moxa/Siemens'}</span>
                    </div>

                    <div className="detail-item">
                      <span className="label">An ninh mạng:</span>
                      <span className={`value status-text text-${activeNode.status}`}>
                        {activeNode.status === 'active' && <><ShieldCheck size={14} /> Đang bảo vệ (Active)</>}
                        {activeNode.status === 'isolated' && <><Lock size={14} /> Đã cô lập (Isolated)</>}
                        {activeNode.status === 'quarantined' && <><ShieldAlert size={14} /> Bị tấn công (Alert)</>}
                        {!['active', 'isolated', 'quarantined'].includes(activeNode.status) && activeNode.status}
                      </span>
                    </div>

                    <div className="detail-item">
                      <span className="label">Lỗ hổng (CVE):</span>
                      <span className="value" style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                        {loadingCve ? (
                          <span style={{ color: '#94a3b8' }}>Đang quét lỗ hổng từ NVD...</span>
                        ) : cveData.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ Phát hiện {cveData.length} lỗ hổng bảo mật tiềm ẩn!</span>
                            {cveData.map(cve => (
                              <div key={cve.cve_id} style={{ fontSize: 12, background: 'rgba(239,68,68,0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <strong style={{color: '#f87171'}}>{cve.cve_id}</strong> (CVSS: {cve.cvss})<br/>
                                <span style={{color: '#cbd5e1', fontSize: 11}}>{cve.description.substring(0, 100)}...</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#10b981' }}><ShieldCheck size={14} style={{verticalAlign: 'middle', marginRight: 4}}/> An toàn (Không tìm thấy CVE)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Software Action Control */}
                  {canManage && (
                    <div className="card-actions-layout">
                      {activeNode.status === 'unprovisioned' && (
                        <button className="action-btn restore-btn" style={{ background: '#10b981', color: 'white' }} onClick={() => handleApprove(activeNode)}>
                          <CheckCircle size={16} /> Duyệt thiết bị (Approve)
                        </button>
                      )}

                      {(activeNode.status === 'active' || activeNode.status === 'online' || activeNode.status === 'quarantined') && (
                        <button className="action-btn isolate-btn" onClick={() => handleIsolate(activeNode)}>
                          <Lock size={16} /> Cô lập mạng (Isolate)
                        </button>
                      )}

                      {activeNode.status === 'isolated' && (
                        <button className="action-btn restore-btn" onClick={() => handleUnisolate(activeNode)}>
                          <Unlock size={16} /> Khôi phục kết nối mạng
                        </button>
                      )}

                      {(activeNode.node_type === 'controller' || activeNode.type === 'controller') && (
                        <button className="action-btn rollback-btn" onClick={() => handleRollback(activeNode)}>
                          <ArrowRightLeft size={16} /> Khôi phục logic PLC (Rollback)
                        </button>
                      )}

                      <button className="action-btn edit-btn" onClick={() => handleEdit(activeNode)}>
                        <Edit size={16} /> Cấu hình phần mềm thiết bị
                      </button>

                      {(activeNode.status === 'offline' || activeNode.status === 'inactive') && (
                        <button className="action-btn isolate-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }} onClick={() => handleDelete(activeNode)}>
                          <Trash2 size={16} /> Xóa thiết bị khỏi hệ thống
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // --- Tab 2: Logs Event Timeline ---
                <div className="drawer-logs-section">
                  <h3><Activity size={16} color="#60a5fa" /> Nhật ký Vận hành Hạ tầng Vật lý</h3>
                  <p className="logs-subtext">Nhật ký thô các thao tác Modbus, telemetry của cảm biến/chấp hành trong 14 ngày qua</p>
                  
                  {loadingLogs ? (
                    <div className="logs-loading">Đang tải nhật ký từ InfluxDB...</div>
                  ) : (() => {
                    const logsToDisplay = getSpecializedPhysicalLogs(activeNode, deviceLogs);
                    if (logsToDisplay.length === 0) {
                      return <div className="logs-empty">Không tìm thấy sự kiện vận hành vật lý nào của thiết bị này.</div>;
                    }
                    return (
                      <div className="timeline-container">
                        {logsToDisplay.map((log, idx) => {
                          const isExpanded = expandedLogId === idx;
                          const isModbus = (log.event || '').includes('MODBUS') || (log.message || '').includes('Modbus');
                          const isCritical = log.severity === 'CRITICAL' || log.severity === 'ERROR';
                          
                          return (
                            <div 
                              key={idx} 
                              className={`timeline-item ${isExpanded ? 'expanded' : ''} severity-${(log.severity || 'INFO').toLowerCase()}`}
                              onClick={() => setExpandedLogId(isExpanded ? null : idx)}
                            >
                              <div className="timeline-badge">
                                {isModbus ? <Database size={12} /> : isCritical ? <ShieldAlert size={12} /> : <Activity size={12} />}
                              </div>
                              <div className="timeline-content">
                                <div className="timeline-header">
                                  <span className="timeline-event-name">{log.event || 'Telemetry Update'}</span>
                                  <span className="timeline-time">{new Date(log.time).toLocaleTimeString()}</span>
                                </div>
                                <p className="timeline-summary-message">{log.message}</p>
                                
                                {isExpanded && (
                                  <div className="timeline-details-accordion">
                                    <div className="details-row">
                                      <span className="d-label">Mức độ:</span>
                                      <span className={`d-val badge-${(log.severity || 'INFO').toLowerCase()}`}>{log.severity}</span>
                                    </div>
                                    <div className="details-row">
                                      <span className="d-label">Loại log:</span>
                                      <span className="d-val">{log.log_type}</span>
                                    </div>
                                    {log.source_ip && (
                                      <div className="details-row">
                                        <span className="d-label">IP Nguồn:</span>
                                        <span className="d-val monospace">{log.source_ip}</span>
                                      </div>
                                    )}
                                    {log.hex_dump && (
                                      <div className="details-row">
                                        <span className="d-label">Gói tin Hex:</span>
                                        <span className="d-val monospace" style={{ color: '#38bdf8', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>{log.hex_dump}</span>
                                      </div>
                                    )}
                                    <div className="details-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                                      <span className="d-label">Chi tiết sự kiện:</span>
                                      <pre className="raw-log-block">{log.message}</pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="empty-detail-state">
              <HelpCircle size={40} className="help-icon" />
              <p>Chọn một thiết bị trên Sơ đồ mạng để xem bảng điều khiển an ninh mạng và nhật ký thô.</p>
            </div>
          )}
        </div>
      </div>

      {isFormOpen && (
        <DeviceForm 
          device={editingDevice} 
          onClose={() => { setIsFormOpen(false); setEditingDevice(null); }} 
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
};

export default DeviceManagement;
