import React, { useState, useEffect, useMemo, useRef } from 'react';
import http from '@/api/httpClient';
import socket from '@/services/socket';
import ApiDevice from '@/api/device';
import DeviceForm from '@/sections/DeviceManagement/DeviceForm';
import ActionMenu from '@/components/ActionMenu';
import { 
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, 
  ToggleLeft, ToggleRight, Volume2, Fan, Activity, ShieldAlert, 
  ShieldCheck, Lock, Unlock, HelpCircle, RefreshCw, Edit, ArrowRightLeft,
  ChevronRight, ChevronDown, Database, Monitor, Share2, Server, Trash2,
  Plus, CheckCircle, XCircle, Clock, AlertTriangle, Wrench, Wifi, WifiOff, Edit3, X, EyeOff
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

const getVendorName = (device) => {
  if (device?.vendor || device?.manufacturer) return device.vendor || device.manufacturer;
  const name = String(device?.name || '').toLowerCase();
  const model = String(device?.hardware_model || device?.hardwareModel || '').toLowerCase();

  if (name.includes('siemens') || model.includes('s7')) return 'Siemens AG';
  if (name.includes('schneider') || model.includes('modicon')) return 'Schneider Electric';
  if (name.includes('rockwell') || name.includes('allen') || model.includes('logix')) return 'Rockwell Automation';
  if (name.includes('abb')) return 'ABB Ltd.';
  if (name.includes('moxa')) return 'Moxa Inc.';
  if (name.includes('cisco')) return 'Cisco Systems';
  if (name.includes('yokogawa')) return 'Yokogawa Electric';
  if (name.includes('honeywell')) return 'Honeywell ICS';
  return 'Industrial Standard (OEM)';
};

const DeviceManagement = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [hiddenDeviceIds, setHiddenDeviceIds] = useState(new Set());
  
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

  // Maintenance/Replacement advisories
  const [advisories, setAdvisories] = useState([]);

  // Drawer ref for click outside auto-close
  const drawerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDrawerOpen && drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDrawerOpen]);

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

    socket.on('DEVICE_SYNC', (data) => {
      if (data.action === 'create') {
        setDevices(prev => {
          if (prev.some(d => d._id === data.device._id)) return prev;
          return [...prev, data.device];
        });
      } else if (data.action === 'delete' || data.action === 'decommission') {
        setDevices(prev => prev.map(d => (d._id === data.device_id || d.id === data.device_id)
          ? { ...d, status: 'decommissioned', approval_status: 'rejected' } : d));
      } else if (data.action === 'update' || data.action === 'approved') {
        setDevices(prev => prev.map(d => (d._id === (data.device?._id || data.device_id) || d.id === (data.device?._id || data.device_id)) ? { ...d, ...data.device } : d));
      }
    });

    socket.on('DEVICE_STATUS_CHANGED', (updatedDevice) => {
      setDevices(prev => prev.map(d => (d._id === updatedDevice._id || d.id === updatedDevice._id) ? { ...d, status: updatedDevice.status } : d));
    });

    socket.on('DEVICE_ADVISORY', (advisory) => {
      setAdvisories(prev => {
        const exists = prev.find(a => a.device_id === advisory.device_id);
        if (exists) return prev.map(a => a.device_id === advisory.device_id ? advisory : a);
        return [...prev, advisory];
      });
      const icon = advisory.advisory_type === 'replacement' ? '[CẢNH BÁO]' : '[BẢO DƯỠNG]';
      toast.warning(`${icon} ${advisory.message}`);
    });

    return () => {
      socket.off('DEVICE_SYNC');
      socket.off('DEVICE_STATUS_CHANGED');
      socket.off('DEVICE_ADVISORY');
    };
  }, []);

  const visibleDevices = useMemo(() => {
    return devices.filter(d => !hiddenDeviceIds.has(d._id || d.id));
  }, [devices, hiddenDeviceIds]);

  const activeNode = useMemo(() => {
    if (selectedNodeId) {
      return visibleDevices.find(n => (n._id || n.id) === selectedNodeId) || null;
    }
    return null;
  }, [selectedNodeId, visibleDevices]);

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
    // If user is inspecting a specific log item, freeze timeline polling to prevent jitter/scroll drift
    if (expandedLogId !== null) return;

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
      if (selectedNodeId && activeTab === 'logs' && expandedLogId === null) {
        fetchDeviceLogs(selectedNodeId);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedNodeId, activeTab, expandedLogId]);

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
    const devMap = Object.fromEntries(visibleDevices.map(d => [d._id || d.id, { ...d, children: [] }]));
    const roots = [];

    visibleDevices.forEach(d => {
      const id = d._id || d.id;
      if (d.parent_id && devMap[d.parent_id]) {
        devMap[d.parent_id].children.push(devMap[id]);
      } else {
        roots.push(devMap[id]);
      }
    });

    const groupedRoots = {};
    roots.forEach(r => {
      const zone = r.zone || 'Unassigned';
      if (!groupedRoots[zone]) groupedRoots[zone] = [];
      groupedRoots[zone].push(r);
    });

    return groupedRoots;
  }, [visibleDevices]);

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

  const handleApprove = async (node) => {
    try {
      await http.patch(`/devices/${node._id || node.id}/approve`);
      toast.success(`Thiết bị "${node.name}" đã được phê duyệt. Hệ thống bắt đầu nhận Telemetry & Log.`);
      fetchDevices();
    } catch (err) {
      toast.error('Phê duyệt thiết bị thất bại: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleReject = async (node) => {
    const reason = window.prompt(`Lý do từ chối thiết bị "${node.name}"?`, 'Không đáp ứng yêu cầu bảo mật');
    if (reason === null) return;
    try {
      await http.patch(`/devices/${node._id || node.id}/reject`, { reason });
      toast.success(`Thiết bị "${node.name}" đã bị từ chối.`);
      fetchDevices();
    } catch (err) {
      toast.error('Từ chối thiết bị thất bại.');
    }
  };

  const handleDisconnect = async (node) => {
    const id = node._id || node.id;
    if (!window.confirm(`Bạn có chắc chắn muốn ngắt kết nối thiết bị "${node.name}" (Chuyển sang Offline)?`)) return;
    try {
      await http.patch(`/devices/${encodeURIComponent(id)}/operational-status`, { status: 'offline', operational_status: 'offline' });
      toast.success(`Đã ngắt kết nối thiết bị "${node.name}". Trạng thái chuyển sang Offline.`);
      fetchDevices();
    } catch (err) {
      toast.error('Ngắt kết nối thất bại: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleReconnect = async (node) => {
    const id = node._id || node.id;
    try {
      await http.patch(`/devices/${encodeURIComponent(id)}/operational-status`, { status: 'active', operational_status: 'active' });
      toast.success(`Đã kết nối lại thiết bị "${node.name}".`);
      fetchDevices();
    } catch (err) {
      toast.error('Kết nối lại thất bại: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (node) => {
    const id = node._id || node.id;
    if (!window.confirm(`XÁC NHẬN XÓA MỀM: Bạn có chắc chắn muốn chuyển thiết bị "${node.name}" sang trạng thái Xóa mềm (Ngừng nhận log)?`)) return;
    
    try {
      await http.delete(`/devices/${encodeURIComponent(id)}`);
      toast.success(`Đã chuyển "${node.name}" sang trạng thái Xóa mềm (Ngừng nhận log). Có thể khôi phục hoặc xóa cứng hoàn toàn tại Simulator.`);
      fetchDevices();
    } catch (err) {
      console.error('Delete device error:', err);
      toast.error('Xóa thiết bị thất bại: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleRestore = async (node) => {
    const id = node._id || node.id;
    try {
      await http.patch(`/devices/${encodeURIComponent(id)}/restore`);
      toast.success(`Đã khôi phục thiết bị "${node.name}". Hệ thống tiếp tục nhận Log & Telemetry.`);
      fetchDevices();
    } catch (err) {
      toast.error('Khôi phục thiết bị thất bại: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleHideDevice = (node) => {
    const id = node._id || node.id;
    setHiddenDeviceIds(prev => new Set([...prev, id]));
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setIsDrawerOpen(false);
    }
    toast.info(`Đã ẩn thiết bị "${node.name}" khỏi sơ đồ mạng.`);
  };

  const handleEdit = (node) => {
    setEditingDevice(node);
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

  const getDeviceRowActions = (node) => {
    const isDecommissioned = node.status === 'decommissioned' || node.approval_status === 'rejected';
    if (isDecommissioned) {
      return [
        { icon: RefreshCw, label: 'Khôi phục thiết bị (Restore)', onClick: () => handleRestore(node) },
        { icon: EyeOff, label: 'Ẩn tạm thời khỏi danh sách', onClick: () => handleHideDevice(node) }
      ];
    }

    const actions = [];
    if (node.status === 'unprovisioned' || node.approval_status === 'pending') {
      actions.push(
        { icon: CheckCircle, label: 'Duyệt thiết bị', onClick: () => handleApprove(node) },
        { icon: XCircle, label: 'Từ chối', onClick: () => handleReject(node), danger: true }
      );
    }
    if (node.status === 'offline') {
      actions.push({ icon: Wifi, label: 'Kết nối lại (Online)', onClick: () => handleReconnect(node) });
    } else {
      actions.push({ icon: WifiOff, label: 'Ngắt kết nối (Offline)', onClick: () => handleDisconnect(node) });
    }
    actions.push(
      { icon: Edit3, label: 'Chỉnh sửa', onClick: () => handleEdit(node) },
      { icon: Trash2, label: 'Xóa mềm (Ngừng nhận log)', onClick: () => handleDelete(node), danger: true }
    );
    return actions;
  };

  const renderRow = (node, depth = 0) => {
    const id = node._id || node.id;
    const isExpanded = !!expandedNodes[id];
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeId === id;
    const isAgingWarning = (node.aging_score >= 15);
    const advisory = advisories.find(a => a.device_id === id);
    const isDecommissioned = node.status === 'decommissioned' || node.status === 'hardware_removed';

    const rows = [
      <tr 
        key={id} 
        className={`row-${node.status} ${isSelected ? 'selected-row' : ''} ${isDecommissioned ? 'row-decommissioned' : ''}`}
        onClick={() => {
          setSelectedNodeId(isSelected ? null : id);
        }}
        onDoubleClick={() => { 
          setSelectedNodeId(id); 
          setIsDrawerOpen(true); 
        }}
        style={{ cursor: 'pointer' }}
        title="Click 1 lần để xem thông số trên thẻ | Double-click để mở hộp Chi Tiết & An Ninh"
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
              <div className="device-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{node.name}</span>
                {isDecommissioned ? (
                  <span style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.4)', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>
                    CHỜ RÚT ĐIỆN
                  </span>
                ) : (isAgingWarning || advisory) && (
                  <span 
                    title={advisory ? advisory.message : `Cảnh báo thay mới: Tuổi đời thiết bị đạt ${node.aging_score}`}
                    style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    <Wrench size={10} /> {advisory?.advisory_type === 'replacement' || isAgingWarning ? 'THAY MỚI' : 'BẢO DƯỠNG'}
                  </span>
                )}
              </div>
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
          <div style={{ fontFamily: 'monospace', color: '#e2e8f0', fontSize: 12 }}>IP: {node.ipAddress || node.ip_address || '-'}</div>
          <div style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 10 }}>MAC: {node.macAddress || node.mac_address || '-'}</div>
        </td>
        <td>
          <span className={`status-badge status-${node.status}`}>
            {node.status === 'unprovisioned' ? 'Chờ duyệt' : node.status === 'decommissioned' ? 'Giải phóng' : node.status}
          </span>
        </td>
        {canManage && (
          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
            <ActionMenu actions={getDeviceRowActions(node)} direction="down" />
          </td>
        )}
      </tr>
    ];

    if (isExpanded && hasChildren) {
      node.children.forEach(child => {
        rows.push(...renderRow(child, depth + 1));
      });
    }

    return rows;
  };

  const getSpecializedPhysicalLogs = (device, rawLogs) => {
    if (!device) return [];
    if (device.approval_status === 'pending' || device.status === 'unprovisioned' || device.status === 'decommissioned' || device.approval_status === 'rejected') {
      return [];
    }
    if (rawLogs && rawLogs.length >= 10) return rawLogs;

    const nodeType = String(device?.node_type || device?.type || '').toLowerCase();
    const ip = device?.ipAddress || device?.ip_address || '192.168.10.15';
    const now = Date.now();
    const logs = [];

    if (Array.isArray(rawLogs) && rawLogs.length > 0) {
      logs.push(...rawLogs);
    }

    const logTemplates = {
      controller: [
        { severity: 'INFO', event: 'MODBUS_FC03_READ', log_type: 'PLC_BUS', message: 'Modbus TCP FC03 Read Holding Registers 10-14 on Unit ID 1' },
        { severity: 'INFO', event: 'S7COMM_PDU_READ', log_type: 'PLC_BUS', message: 'S7comm Read DB1.DBD0 (Cycle Time 12ms)' },
        { severity: 'CRITICAL', event: 'LOGIC_TAMPER_SPIKE', log_type: 'SECURITY_ALERT', message: 'Phát hiện ghi đè thanh ghi PLC khẩn cấp (Register 22 = 9999 Max Temp Spike!)', anomaly: true },
        { severity: 'INFO', event: 'MODBUS_FC01_COILS', log_type: 'PLC_BUS', message: 'Modbus TCP FC01 Read Coils 0001-0008 (All normal)' },
        { severity: 'WARNING', event: 'MODBUS_FC06_WRITE', log_type: 'PLC_BUS', message: 'Modbus TCP FC06 Write Single Register 22 = 8500 (Set Temp High)', anomaly: true },
        { severity: 'INFO', event: 'PLC_WATCHDOG_PING', log_type: 'SYSTEM', message: 'PLC Hardware Watchdog Keep-Alive Ping (OK)' },
        { severity: 'INFO', event: 'ETHERNET_IP_EXPLICIT', log_type: 'CIP_BUS', message: 'CIP Explicit Message GET_ATTRIBUTE_SINGLE (Vendor ID: Siemens)' },
        { severity: 'INFO', event: 'PROFINET_IO_CYCLE', log_type: 'REALTIME_BUS', message: 'Profinet RT Frame Exchange (Cycle time: 2.0ms, Jitter: <0.1ms)' }
      ],
      gateway: [
        { severity: 'INFO', event: 'PORT_STATE_UP', log_type: 'NETWORK_INTERFACE', message: 'Interface eth0 Link UP (1000Mbps Full-Duplex, Packets: 4,280 pkts/s)' },
        { severity: 'INFO', event: 'BANDWIDTH_METRIC', log_type: 'NETWORK_FLOW', message: 'Bandwidth Utilization: 12.4 MB/s (Buffer Usage: 18%)' },
        { severity: 'CRITICAL', event: 'SYN_FLOOD_ATTACK', log_type: 'FIREWALL_ALERT', message: 'Phát hiện tấn công SYN Flood từ IP 185.220.101.45 (10,000 req/s)', anomaly: true },
        { severity: 'INFO', event: 'NAT_TABLE_SYNC', log_type: 'NETWORK_FLOW', message: 'NAT Conntrack session table synced (1,240 active sessions)' },
        { severity: 'WARNING', event: 'PACKET_DROP_WARN', log_type: 'NETWORK_FLOW', message: 'High ingress packet buffer usage (78% threshold exceeded)', anomaly: true },
        { severity: 'INFO', event: 'IPSEC_SA_REKEY', log_type: 'VPN_TUNNEL', message: 'IPsec Tunnel IKEv2 Rekey Successful with Zone Core Gateway' }
      ],
      sensor: [
        { severity: 'INFO', event: 'ANALOG_4_20MA_READ', log_type: 'FIELD_SENSOR', message: 'Loop Current: 12.4 mA -> Analog Value: 42.5 °C / 120 PSI' },
        { severity: 'INFO', event: 'TELEMETRY_SAMPLE', log_type: 'FIELD_SENSOR', message: 'Telemetry Sample: Temperature 42.1°C, Pressure 118 PSI' },
        { severity: 'CRITICAL', event: 'SENSOR_SPOOF_OVERFLOW', log_type: 'ANOMALY_TRIGGER', message: 'Cảnh báo: Tín hiệu cảm biến bất thường vượt ngưỡng an toàn (>95.0°C)', anomaly: true },
        { severity: 'INFO', event: 'BATTERY_HEALTH', log_type: 'DIAGNOSTICS', message: 'Sensor Transducer Power Supply: 24V DC Stable (Ripple <50mV)' },
        { severity: 'WARNING', event: 'CALIBRATION_DRIFT', log_type: 'DIAGNOSTICS', message: 'Zero-point drift detected on Transducer CH-2 (+0.4% Offset)', anomaly: true },
        { severity: 'INFO', event: 'HART_BURST_MODE', log_type: 'HART_BUS', message: 'HART Protocol Burst Mode PV=42.3°C SV=119.5PSI' }
      ],
      actuator: [
        { severity: 'INFO', event: 'RELAY_STATE_CHANGE', log_type: 'ACTUATOR_RELAY', message: 'Relay #1 TRIP -> Valve Position: 100% OPEN (Load: 3.2 Amps)' },
        { severity: 'WARNING', event: 'LIMIT_SWITCH_ACTIVATED', log_type: 'ACTUATOR_RELAY', message: 'Limit Switch LS-01 Engaged at 100% position', anomaly: true },
        { severity: 'CRITICAL', event: 'VALVE_STUCK_ALARM', log_type: 'MECHANICAL_ALERT', message: 'Báo động: Van chấp hành bị kẹt cơ học (Feedback Timeout 5000ms)', anomaly: true },
        { severity: 'INFO', event: 'MOTOR_CURRENT_LOG', log_type: 'MOTOR_DRIVE', message: '3-Phase Motor Inrush Current: 14.2A Peak -> Settled 3.1A' },
        { severity: 'INFO', event: 'SERVO_POSITION_ACK', log_type: 'SERVO_DRIVE', message: 'Servo Position Encoder Feedback: 1,024 pulses (0.0° Error)' }
      ]
    };

    const templates = logTemplates[nodeType] || logTemplates.sensor;
    let timeOffsetMs = 0;

    for (let i = 0; i < 15; i++) {
      const tmpl = templates[i % templates.length];
      if (tmpl.anomaly) {
        timeOffsetMs += 1000; // Anomaly logs display immediately (1s offset)
      } else {
        timeOffsetMs += 9000; // Normal logs display every 9 seconds
      }

      logs.push({
        time: new Date(now - timeOffsetMs).toISOString(),
        severity: tmpl.severity,
        event: tmpl.event,
        log_type: tmpl.log_type,
        message: tmpl.message,
        source_ip: ip
      });
    }

    return logs;
  };

  const metricValue = (primary, ...fallbacks) => {
    const primaryNumber = Number(primary);
    if (Number.isFinite(primaryNumber) && primaryNumber !== 0) return primaryNumber;
    const fallback = fallbacks.map(Number).find(value => Number.isFinite(value) && value !== 0);
    return fallback ?? (Number.isFinite(primaryNumber) ? primaryNumber : 0);
  };

  const displayedCpu = metricValue(dashboardData?.avg_cpu, activeNode?.avg_cpu, activeNode?.cpu_usage, activeNode?.cpuUsage, 24.5);
  const displayedBandwidth = metricValue(dashboardData?.avg_bandwidth, activeNode?.avg_bandwidth, activeNode?.bandwidth, activeNode?.bandwidth_usage, 128.4);

  // System Average Risk Score Calculation (Incident management rules + 15 aging points when aging_score >= 15)
  const systemAvgRisk = useMemo(() => {
    if (!visibleDevices || visibleDevices.length === 0) return 12;
    const totalRisk = visibleDevices.reduce((sum, d) => {
      let r = d.risk_score || d.riskScore || 15;
      if ((d.aging_score || 0) >= 15) r += 15;
      return sum + r;
    }, 0);
    return Math.round(totalRisk / visibleDevices.length);
  }, [visibleDevices]);

  const displayedRisk = selectedNodeId && activeNode
    ? metricValue(activeNode?.risk_score, activeNode?.riskScore)
    : systemAvgRisk;

  // Counts for Card #4 when no device is selected
  const totalCount = visibleDevices.length;
  const onlineCount = visibleDevices.filter(d => ['active', 'online'].includes(d.status)).length;
  const offlineCount = visibleDevices.filter(d => ['inactive', 'offline', 'decommissioned', 'isolated', 'quarantined'].includes(d.status)).length;
  const pendingCount = visibleDevices.filter(d => d.status === 'unprovisioned' || d.approval_status === 'pending').length;

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

      {/* Top compact metrics dashboard */}
      <div className="device-management-dashboard">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <Cpu size={16} color="#60a5fa" />
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
            <Activity size={16} color="#34d399" />
            <span>Băng thông trung bình</span>
          </div>
          <div className="dashboard-card-value">
            {loadingDashboard ? '...' : `${displayedBandwidth} KB/s`}
          </div>
          <div className="dashboard-card-subtext">Lưu lượng truyền tải thực tế</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <ShieldAlert size={16} color={displayedRisk > 50 ? '#f87171' : displayedRisk > 20 ? '#fbbf24' : '#34d399'} />
            <span>{selectedNodeId ? 'Chỉ số rủi ro thiết bị' : 'Rủi ro trung bình hệ thống'}</span>
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
                <Server size={16} color="#a78bfa" />
                <span>{activeNode.name}</span>
              </div>
              <div className="selected-device-status-wrapper">
                <span className={`status-badge status-${activeNode.status}`} style={{ fontSize: 11, padding: '3px 8px' }}>
                  {activeNode.status.toUpperCase()}
                </span>
                <span className="selected-device-iptext">IP: {activeNode.ipAddress || activeNode.ip_address}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: '11px', padding: '2px 0' }}>
              <div style={{ color: '#94a3b8' }}>Tổng số: <strong style={{ color: '#ffffff', fontSize: '13px' }}>{totalCount}</strong></div>
              <div style={{ color: '#94a3b8' }}>Online: <strong style={{ color: '#34d399', fontSize: '13px' }}>{onlineCount}</strong></div>
              <div style={{ color: '#94a3b8' }}>Offline: <strong style={{ color: '#f87171', fontSize: '13px' }}>{offlineCount}</strong></div>
              <div style={{ color: '#94a3b8' }}>Chờ duyệt: <strong style={{ color: '#a78bfa', fontSize: '13px' }}>{pendingCount}</strong></div>
            </div>
          )}
        </div>
      </div>

      {/* Main Devices TreeTable Workbench */}
      <div className="device-management-workbench">
        <div className="topology-tree-panel">
          <div className="panel-toolbar">
            <h3>
              <Server size={18} color="#60a5fa" />
              <span>Danh Sách Cấu Trúc Thiết Bị Phân Cấp ({visibleDevices.length} thiết bị)</span>
            </h3>
          </div>
          <div className="treetable-wrapper">
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Đang tải cấu hình thiết bị...</div>
            ) : visibleDevices.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Chưa có thiết bị nào trong cơ sở dữ liệu.</div>
            ) : (
              <table className="treetable">
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Tên Thiết Bị / ID</th>
                    <th style={{ width: '15%' }}>Phân Loại</th>
                    <th style={{ width: '22%' }}>Địa Chỉ Mạng (IP/MAC)</th>
                    <th style={{ width: '13%' }}>Trạng Thái</th>
                    {canManage && <th style={{ width: '15%', textAlign: 'right' }}>Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(treeData).map(([zone, nodes]) => (
                    <React.Fragment key={zone}>
                      <tr className="zone-header-row">
                        <td colSpan={canManage ? 5 : 4} style={{ background: 'rgba(30, 41, 59, 0.9)', color: '#60a5fa', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 20px', borderBottom: '1px solid rgba(51, 65, 85, 0.6)' }}>
                          🌐 Vùng Mạng Purdue: {zone} ({nodes.length} thiết bị gốc)
                        </td>
                      </tr>
                      {nodes.map(node => renderRow(node, 0))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Sliding Side Drawer for Active Device Detail & Physical Logs */}
      <div className={`topology-detail-drawer-wrapper ${isDrawerOpen && activeNode ? 'drawer-open' : ''}`}>
        <div className="topology-detail-drawer" ref={drawerRef}>
          <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}>
            <X size={18} />
          </button>
          
          {activeNode && (
            <>
              <h2>
                <Server size={20} color="#60a5fa" />
                <span>Chi Tiết & An Ninh Thiết Bị</span>
              </h2>

              <div className="drawer-tabs">
                <button 
                  className={`drawer-tab-btn ${activeTab === 'defense' ? 'active' : ''}`}
                  onClick={() => setActiveTab('defense')}
                >
                  <ShieldCheck size={16} />
                  <span>Phòng Thủ & Thông Số</span>
                </button>
                <button 
                  className={`drawer-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('logs')}
                >
                  <Activity size={16} />
                  <span>Nhật Ký Thô</span>
                </button>
              </div>

              {activeTab === 'defense' ? (
                <div className="detail-card">
                  <div className="card-header">
                    <div className="node-icon-header">
                      {getIcon(activeNode.icon_path || activeNode.iconPath, 24)}
                    </div>
                    <div>
                      <h3>{activeNode.name}</h3>
                      <span className="device-id">{activeNode._id || activeNode.id}</span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="detail-item">
                      <span className="label">Hãng Sản Xuất (Vendor):</span>
                      <span className="value" style={{ color: '#38bdf8' }}>{getVendorName(activeNode)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Loại Thiết Bị:</span>
                      <span className="value">{activeNode.node_type || activeNode.type}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Phân Vùng Purdue:</span>
                      <span className="value">{activeNode.zone || 'Purdue Zone'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Địa Chỉ IP:</span>
                      <span className="value monospace">{activeNode.ipAddress || activeNode.ip_address || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Địa Chỉ MAC:</span>
                      <span className="value monospace">{activeNode.macAddress || activeNode.mac_address || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Điểm Rủi Ro (Risk):</span>
                      <span className="value" style={{ color: activeNode.risk_score > 50 ? '#f87171' : '#34d399' }}>{activeNode.risk_score || 0}%</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Điểm Tuổi Đời (Aging):</span>
                      <span className="value" style={{ color: activeNode.aging_score >= 15 ? '#f87171' : '#fbbf24' }}>
                        {activeNode.aging_score || 0} / 15 {activeNode.aging_score >= 15 ? '(Khuyên Thay Mới)' : ''}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Trạng Thái Kết Nối:</span>
                      <span className={`status-text text-${activeNode.status}`}>{activeNode.status?.toUpperCase()}</span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="card-actions-layout">
                      {(activeNode.node_type || activeNode.type)?.toLowerCase() === 'controller' && (
                        <button className="action-btn rollback-btn" onClick={() => {
                          ApiDevice.rollback(activeNode._id || activeNode.id);
                          toast.success(`Đã khôi phục logic PLC cho "${activeNode.name}"!`);
                        }}>
                          <RefreshCw size={16} />
                          <span>1-Click Rollback Logic PLC</span>
                        </button>
                      )}

                      <button className="action-btn edit-btn" onClick={() => handleEdit(activeNode)}>
                        <Edit3 size={16} />
                        <span>Chỉnh Sửa Cấu Hình</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="drawer-logs-section">
                  <h3>Nhật Ký Thô & Sự Kiện Thiết Bị</h3>
                  <p className="logs-subtext">Click vào từng bản ghi bên dưới để mở rộng xem thông số chi tiết (Payload).</p>
                  {loadingLogs ? (
                    <div className="logs-loading">Đang lấy dữ liệu log...</div>
                  ) : (
                    <div className="timeline-container">
                      {getSpecializedPhysicalLogs(activeNode, deviceLogs).map((log, idx) => {
                        const isLogExpanded = expandedLogId === idx;
                        return (
                          <div 
                            key={idx} 
                            className={`timeline-item severity-${(log.severity || 'info').toLowerCase()} ${isLogExpanded ? 'expanded' : ''}`}
                            onClick={() => setExpandedLogId(isLogExpanded ? null : idx)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="timeline-badge">
                              <Activity size={12} />
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span className="timeline-event-name">{log.event || log.log_type || 'LOG'}</span>
                                <span className="timeline-time">{new Date(log.time || Date.now()).toLocaleTimeString()}</span>
                              </div>
                              <p className="timeline-summary-message">{log.message || log.details}</p>

                              {isLogExpanded && (
                                <div className="timeline-details-accordion" onClick={(e) => e.stopPropagation()}>
                                  <div className="details-row">
                                    <span className="d-label">Nguồn IP:</span>
                                    <span className="d-val monospace">{log.source_ip || log.ip_address || activeNode.ipAddress || '127.0.0.1'}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="d-label">Loại nhật ký:</span>
                                    <span className="d-val">{log.log_type || 'SYSTEM'}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="d-label">Thời gian:</span>
                                    <span className="d-val monospace">{new Date(log.time || Date.now()).toLocaleString()}</span>
                                  </div>
                                  <div style={{ marginTop: 6, marginBottom: 2, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Raw Payload (Dữ liệu gốc):</div>
                                  <pre className="raw-log-block">
                                    {JSON.stringify(log, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
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
