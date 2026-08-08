import './HardwareSimulator.scss';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { hardwareApi } from '@/http/clients/trustEdges';
import {
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, HardDrive,
  Trash2, Plus, RefreshCw, Server, Wifi, Activity, ChevronRight, X,
  AlertTriangle, CheckCircle, Settings, Save, RotateCcw, Info, Layers,
  Monitor, Database, Shield, Flame, Waves, Bell, Power, Eye,
  GitMerge, Signal, Lock, Siren, Scan, Nfc, BrainCircuit, Wrench, WifiOff, ShieldAlert
} from 'lucide-react';
import { toast } from '@/utils/toast';
import socket from '@/services/socket';

// ============================================================
// ERROR BOUNDARY CLASS FOR SIMULATOR
// ============================================================
class SimulatorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[SimulatorErrorBoundary Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 24px', background: '#090d16', minHeight: '100vh', color: '#f8fafc', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', margin: '0 0 8px', color: '#f8fafc' }}>ICS-Guard Physical Simulator</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', maxWidth: '500px', lineHeight: 1.6, margin: '0 0 20px' }}>
            Hệ thống tạm thời cần làm mới bộ nhớ cache dữ liệu: {this.state.error?.message || 'Tải lại trang'}.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('sim_positions_v2');
              window.location.reload();
            }}
            style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            Làm sạch bộ nhớ & Tải lại ứng dụng
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// ZONES
// ============================================================
const DEFAULT_ZONES = [
  { id: 'Zone-A', label: 'Zone-A — Hệ thống Nước',    subnet: '10', color: '#3b82f6', cssClass: 'zone-a' },
  { id: 'Zone-B', label: 'Zone-B — Lưới Điện',         subnet: '20', color: '#10b981', cssClass: 'zone-b' },
  { id: 'Zone-C', label: 'Zone-C — HVAC Nhiệt lạnh',   subnet: '30', color: '#8b5cf6', cssClass: 'zone-c' },
];

const generateZoneColor = (index) => {
  const colors = ['#f43f5e', '#d946ef', '#8b5cf6', '#6366f1', '#0ea5e9', '#14b8a6', '#84cc16', '#eab308', '#f97316', '#ef4444'];
  return colors[index % colors.length];
};

// ============================================================
// DEVICE CATALOG — 22 loại thiết bị ICS/IoT
// ============================================================
const DEVICE_TYPES = [
  { group: 'Hạ tầng mạng', type: 'gateway', label: 'Industrial Gateway', icon: 'Network', color: '#3b82f6', hw: 'Moxa Switch EDS-408A', fw: '3.5.2', canBeParent: true, needsParent: false },
  { group: 'Hạ tầng mạng', type: 'scada', label: 'SCADA Server', icon: 'Monitor', color: '#0ea5e9', hw: 'Wonderware InTouch 2020', fw: '20.1.0', canBeParent: true, needsParent: false },
  { group: 'Hạ tầng mạng', type: 'hmi', label: 'HMI Terminal', icon: 'Scan', color: '#38bdf8', hw: 'Siemens KTP900 Basic', fw: 'V16.0.1', canBeParent: false, needsParent: false },
  { group: 'Hạ tầng mạng', type: 'firewall', label: 'Industrial Firewall', icon: 'Shield', color: '#64748b', hw: 'Fortinet FortiGate-60F', fw: '7.4.2', canBeParent: true, needsParent: false },
  { group: 'Bộ điều khiển', type: 'controller', label: 'PLC / Controller', icon: 'Cpu', color: '#f59e0b', hw: 'Siemens S7-1200 PLC', fw: '4.2.1', canBeParent: true, needsParent: false },
  { group: 'Bộ điều khiển', type: 'rtu', label: 'RTU (Remote Terminal)', icon: 'GitMerge', color: '#fb923c', hw: 'Schneider SCADAPack 350E', fw: '8.21.0', canBeParent: true, needsParent: false },
  { group: 'Bộ điều khiển', type: 'dcs', label: 'DCS Controller', icon: 'BrainCircuit', color: '#f97316', hw: 'Honeywell Experion PKS C300', fw: 'R510.2', canBeParent: true, needsParent: false },
  { group: 'Edge / Comm', type: 'chip', label: 'ESP32 Edge Module', icon: 'Radio', color: '#14b8a6', hw: 'ESP32-WROOM-32', fw: 'ESP-IDF v5.1', canBeParent: true, needsParent: true },
  { group: 'Edge / Comm', type: 'opc_server', label: 'OPC-UA Server', icon: 'Database', color: '#06b6d4', hw: 'Prosys OPC UA Simulation Srv', fw: '5.4.6', canBeParent: true, needsParent: true },
  { group: 'Edge / Comm', type: 'protocol_bridge', label: 'Protocol Bridge', icon: 'Nfc', color: '#22d3ee', hw: 'Moxa MGate MB3480', fw: '2.8', canBeParent: true, needsParent: true },
  { group: 'Edge / Comm', type: 'camera', label: 'IP Camera / Vision', icon: 'Eye', color: '#a78bfa', hw: 'Axis P3245-V', fw: '11.0.4', canBeParent: false, needsParent: true },
  { group: 'Cảm biến', type: 'sensor', label: 'Nhiệt độ / Humidity', icon: 'Thermometer', color: '#db2777', hw: 'Honeywell HIH6130', fw: '1.0.5', canBeParent: false, needsParent: true },
  { group: 'Cảm biến', type: 'sensor_pressure', label: 'Cảm biến áp suất', icon: 'Gauge', color: '#e11d48', hw: 'Emerson Rosemount 3051C', fw: 'v2.1', canBeParent: false, needsParent: true },
  { group: 'Cảm biến', type: 'sensor_flow', label: 'Đồng hồ lưu lượng', icon: 'Waves', color: '#be185d', hw: 'Endress+Hauser Promag 53W', fw: '3.05.01', canBeParent: false, needsParent: true },
  { group: 'Cảm biến', type: 'sensor_gas', label: 'Gas Detector', icon: 'Flame', color: '#dc2626', hw: 'MSA Ultima X5000', fw: 'v1.3.0', canBeParent: false, needsParent: true },
  { group: 'Cảm biến', type: 'sensor_vibration', label: 'Vibration Monitor', icon: 'Activity', color: '#c026d3', hw: 'SKF Multilog IMx-8', fw: '2.4.0', canBeParent: false, needsParent: true },
  { group: 'Cảm biến', type: 'sensor_level', label: 'Level Sensor', icon: 'Layers', color: '#9333ea', hw: 'VEGAPULS 64 Radar', fw: '1.3.7', canBeParent: false, needsParent: true },
  { group: 'Chấp hành', type: 'actuator', label: 'Valve / Actuator', icon: 'Wind', color: '#7c3aed', hw: 'Belimo LRB24-3-T', fw: '2.1.0', canBeParent: false, needsParent: true },
  { group: 'Chấp hành', type: 'pump', label: 'Bơm nước / Lưu chất', icon: 'Droplets', color: '#2563eb', hw: 'Grundfos CR 10-8', fw: 'v1.2', canBeParent: false, needsParent: true },
  { group: 'Chấp hành', type: 'motor', label: 'Motor Drive (VFD)', icon: 'Zap', color: '#ca8a04', hw: 'ABB ACS880-01-045A-3', fw: '2.72', canBeParent: false, needsParent: true },
  { group: 'Chấp hành', type: 'breaker', label: 'Circuit Breaker', icon: 'Power', color: '#16a34a', hw: 'Schneider PowerPact H-Frame', fw: 'v3.0', canBeParent: false, needsParent: true },
  { group: 'Chấp hành', type: 'alarm', label: 'Alarm / Siren', icon: 'Bell', color: '#ef4444', hw: 'Patlite LR7-E', fw: 'v2.0', canBeParent: false, needsParent: true },
];

const TYPE_META = Object.fromEntries(DEVICE_TYPES.map(t => [t.type, t]));

const DEVICE_GROUPS = DEVICE_TYPES.reduce((acc, t) => {
  if (!acc[t.group]) acc[t.group] = [];
  acc[t.group].push(t);
  return acc;
}, {});

const ICON_MAP = {
  Network: <Network size={18} />, Cpu: <Cpu size={18} />, Radio: <Radio size={18} />, Thermometer: <Thermometer size={18} />,
  Droplets: <Droplets size={18} />, Zap: <Zap size={18} />, Wind: <Wind size={18} />, Gauge: <Gauge size={18} />,
  HardDrive: <HardDrive size={18} />, Monitor: <Monitor size={18} />, Database: <Database size={18} />, Shield: <Shield size={18} />,
  Flame: <Flame size={18} />, Waves: <Waves size={18} />, Bell: <Bell size={18} />, Power: <Power size={18} />,
  Eye: <Eye size={18} />, GitMerge: <GitMerge size={18} />, Activity: <Activity size={18} />, Layers: <Layers size={18} />,
  Scan: <Scan size={18} />, Nfc: <Nfc size={18} />, BrainCircuit: <BrainCircuit size={18} />, Server: <Server size={18} />,
};

const ICON_MAP_SM = {
  Network: <Network size={13} />, Cpu: <Cpu size={13} />, Radio: <Radio size={13} />, Thermometer: <Thermometer size={13} />,
  Droplets: <Droplets size={13} />, Zap: <Zap size={13} />, Wind: <Wind size={13} />, Gauge: <Gauge size={13} />,
  HardDrive: <HardDrive size={13} />, Monitor: <Monitor size={13} />, Database: <Database size={13} />, Shield: <Shield size={13} />,
  Flame: <Flame size={13} />, Waves: <Waves size={13} />, Bell: <Bell size={13} />, Power: <Power size={13} />,
  Eye: <Eye size={13} />, GitMerge: <GitMerge size={13} />, Activity: <Activity size={13} />, Layers: <Layers size={13} />,
  Scan: <Scan size={13} />, Nfc: <Nfc size={13} />, BrainCircuit: <BrainCircuit size={13} />, Server: <Server size={13} />,
};

const getIcon = (iconPath, size = 'md') =>
  (size === 'sm' ? ICON_MAP_SM[iconPath] : ICON_MAP[iconPath]) || (size === 'sm' ? <HardDrive size={13} /> : <HardDrive size={18} />);

const generateIp = (zone, existingIps = [], allZones = DEFAULT_ZONES) => {
  const z = allZones.find(z => z.id === zone);
  const subnet = z?.subnet || '10';
  let ip, tries = 0;
  do {
    ip = `192.168.${subnet}.${Math.floor(Math.random() * 253) + 1}`;
    tries++;
  } while (existingIps.includes(ip) && tries < 100);
  return ip;
};

const generateMac = () =>
  Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(':');

const normalizeDevice = (device) => {
  if (!device) return null;
  const id = device._id ?? device.id ?? device.device_id;
  if (id === undefined || id === null || id === '') return null;
  const parentId = device.parent_id ?? device.parentId ?? null;
  return {
    ...device,
    _id: String(id),
    id: String(id),
    parent_id: parentId === undefined || parentId === null || parentId === '' ? null : String(parentId),
    node_type: device.node_type || device.type || 'sensor',
    zone: device.zone || 'Zone-A',
    status: device.status || device.operational_status || 'offline',
    approval_status: device.approval_status || ((device.status === 'unprovisioned' || device.operational_status === 'unprovisioned') ? 'pending' : 'approved')
  };
};

const INFRASTRUCTURE_TYPES = new Set(['gateway', 'scada', 'firewall']);

const PROCESSING_TYPES = new Set([
  'gateway', 'scada', 'firewall',
  'controller', 'rtu', 'dcs',
  'chip', 'opc_server', 'protocol_bridge'
]);

const ENDPOINT_TYPES  = new Set(['sensor', 'sensor_pressure', 'sensor_flow', 'sensor_gas',
                                  'sensor_vibration', 'sensor_level', 'actuator', 'pump',
                                  'motor', 'breaker', 'alarm', 'camera', 'hmi']);

const canParent = (parentType, childType) => {
  if (!parentType || !childType) return false;
  // 1. Infrastructure core nodes (Gateway, SCADA Server, Firewall) can parent any processing node or endpoint
  if (INFRASTRUCTURE_TYPES.has(parentType)) {
    return PROCESSING_TYPES.has(childType) || ENDPOINT_TYPES.has(childType);
  }
  // 2. Control & Edge Layer (PLC Controller, RTU, DCS, ESP32 Chip, OPC Server, Protocol Bridge)
  //    Can parent other Control/Edge nodes or Endpoints, but CANNOT parent Core Infrastructure
  if (['controller', 'rtu', 'dcs', 'chip', 'opc_server', 'protocol_bridge'].includes(parentType)) {
    if (INFRASTRUCTURE_TYPES.has(childType)) return false;
    return PROCESSING_TYPES.has(childType) || ENDPOINT_TYPES.has(childType);
  }
  // 3. Field Endpoints (Sensors, Actuators, HMI, Cameras) cannot parent any device
  return false;
};

const CM_2_PX = 76; // 2cm in CSS pixels (1cm ≈ 37.8px)
const NODE_W  = 90;
const NODE_H  = 80;
const H_GAP   = 76; // 2cm minimum gap between adjacent nodes
const V_GAP   = 76; // 2cm minimum gap between node levels
const PAD_TOP = CM_2_PX + NODE_H / 2; // 116px (node top edge is 76px / 2cm from top border)
const PAD_L   = CM_2_PX + NODE_W / 2; // 121px (node left edge is 76px / 2cm from left border)

const computeHierarchicalLayout = (zoneDevs) => {
  if (!zoneDevs || !zoneDevs.length) return {};
  const devMap = Object.fromEntries(zoneDevs.map(d => [d._id, d]));
  const roots = zoneDevs.filter(d => !d.parent_id || !devMap[d.parent_id]);
  const getChildren = id => zoneDevs.filter(d => d.parent_id === id);

  const subtreeWidth = (id, visited = new Set()) => {
    if (visited.has(id)) return NODE_W;
    visited.add(id);
    const children = getChildren(id);
    if (!children.length) return NODE_W;
    const childTotal = children.reduce((s, c) => s + subtreeWidth(c._id, new Set(visited)), 0)
      + H_GAP * (children.length - 1);
    return Math.max(NODE_W, childTotal);
  };

  const result = {};
  const placeNode = (id, centreX, level, visited = new Set()) => {
    if (visited.has(id)) return;
    visited.add(id);
    result[id] = { x: centreX, y: PAD_TOP + level * (NODE_H + V_GAP) };
    const children = getChildren(id);
    if (!children.length) return;
    const widths = children.map(c => subtreeWidth(c._id));
    const totalW = widths.reduce((a, b) => a + b, 0) + H_GAP * (children.length - 1);
    let curX = centreX - totalW / 2 + widths[0] / 2;
    children.forEach((child, i) => {
      placeNode(child._id, curX, level + 1, new Set(visited));
      if (i < children.length - 1) curX += widths[i] / 2 + H_GAP + widths[i + 1] / 2;
    });
  };

  if (roots.length === 0) return result;
  const rootWidths = roots.map(r => subtreeWidth(r._id));
  const totalRootW = rootWidths.reduce((a, b) => a + b, 0) + H_GAP * (roots.length - 1);
  let curX = PAD_L + rootWidths[0] / 2;
  if (roots.length === 1) curX = Math.max(PAD_L + NODE_W / 2, totalRootW / 2 + PAD_L);
  roots.forEach((root, i) => {
    placeNode(root._id, curX, 0);
    if (i < roots.length - 1) curX += rootWidths[i] / 2 + H_GAP + rootWidths[i + 1] / 2;
  });

  // Ensure minimum 2cm boundary (76px) from left and top for all nodes
  const minX = Math.min(...Object.values(result).map(p => p.x - NODE_W / 2));
  const minY = Math.min(...Object.values(result).map(p => p.y - NODE_H / 2));

  const targetMinX = CM_2_PX;
  const targetMinY = CM_2_PX;

  const shiftX = minX < targetMinX ? targetMinX - minX : 0;
  const shiftY = minY < targetMinY ? targetMinY - minY : 0;

  if (shiftX !== 0 || shiftY !== 0) {
    Object.keys(result).forEach(id => {
      result[id].x += shiftX;
      result[id].y += shiftY;
    });
  }

  return result;
};

const HardwareSimulatorMain = () => {
  const [customZones, setCustomZones] = useState([]);
  const [deletedZones, setDeletedZones] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sim_deleted_zones') || '[]'); }
    catch (err) { return []; }
  });
  const [devices, setDevices] = useState([]);

  const deviceMap = useMemo(() => Object.fromEntries(devices.map(d => [d._id, d])), [devices]);

  const allZones = useMemo(() => {
    const zonesMap = new Map();
    DEFAULT_ZONES.forEach(z => {
      if (!deletedZones.includes(z.id)) zonesMap.set(z.id, z);
    });
    customZones.forEach(z => {
      if (!deletedZones.includes(z.id)) zonesMap.set(z.id, z);
    });
    
    devices.forEach(d => {
      const zId = d.zone || 'Zone-A';
      if (!zonesMap.has(zId)) {
        zonesMap.set(zId, {
          id: zId,
          label: zId,
          subnet: Math.floor(Math.random() * 253 + 1).toString(),
          color: generateZoneColor(zonesMap.size),
          cssClass: 'zone-dynamic'
        });
      }
    });
    return Array.from(zonesMap.values());
  }, [devices, customZones, deletedZones]);

  const [loading, setLoading]           = useState(true);
  const [logs, setLogs]                 = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [editForm, setEditForm]         = useState(null);
  const [savingEdit, setSavingEdit]     = useState(false);

  const [zoneCollapsed, setZoneCollapsed] = useState({});
  const [nodeCollapsed, setNodeCollapsed] = useState({});

  const [positions, setPositions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sim_positions_v2') || '{}'); }
    catch (err) { return {}; }
  });

  const [dragNodeId, setDragNodeId]     = useState(null);
  const dragOffset                       = useRef({ x: 0, y: 0 });

  const [isPanning, setIsPanning]       = useState(false);
  const panStartRef                      = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const [dragOverZone, setDragOverZone] = useState(null);
  const [dragTemplate, setDragTemplate] = useState(null);
  const [modal, setModal]               = useState(null);
  const [canvasScale, setCanvasScale]   = useState(1.0);

  const logsEndRef = useRef(null);
  const canvasScrollRef = useRef(null);

  const selectedDevice = selectedId ? deviceMap[selectedId] : null;

  const scrollToDeviceOnCanvas = useCallback((deviceId) => {
    setSelectedId(deviceId);
    setTimeout(() => {
      const nodeEl = document.querySelector(`[data-node-id="${deviceId}"]`);
      const containerEl = canvasScrollRef.current;
      if (nodeEl && containerEl) {
        const nodeRect = nodeEl.getBoundingClientRect();
        const containerRect = containerEl.getBoundingClientRect();
        
        const scrollLeft = containerEl.scrollLeft + (nodeRect.left - containerRect.left) - (containerRect.width / 2) + (nodeRect.width / 2);
        const scrollTop = containerEl.scrollTop + (nodeRect.top - containerRect.top) - (containerRect.height / 2) + (nodeRect.height / 2);
        
        containerEl.scrollTo({
          left: Math.max(0, scrollLeft),
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
      }
    }, 50);
  }, []);

  const isDeviceReachable = useCallback((deviceId) => {
    let current = deviceMap[deviceId];
    const visited = new Set();
    while (current) {
      if (visited.has(current._id)) break;
      visited.add(current._id);
      if (current.status === 'offline') return false;
      current = current.parent_id ? deviceMap[current.parent_id] : null;
    }
    return true;
  }, [deviceMap]);

  const existingIps = useMemo(() => devices.map(d => d.ipAddress || d.ip_address).filter(Boolean), [devices]);

  const byZone = useMemo(() => {
    const result = {};
    allZones.forEach(z => { result[z.id] = []; });
    devices.forEach(d => {
      const zone = d.zone || 'Zone-A';
      if (!result[zone]) result[zone] = [];
      result[zone].push(d);
    });
    return result;
  }, [devices, allZones]);

  const buildTree = useCallback((zoneId) => {
    const zoneDevs = byZone[zoneId] || [];
    const devMap = Object.fromEntries(zoneDevs.map(d => [d._id, d]));

    const assemble = (dev, visited = new Set()) => {
      if (!dev || visited.has(dev._id)) return { node: dev, depth: 0, children: [] };
      visited.add(dev._id);
      const children = zoneDevs
        .filter(d => d.parent_id === dev._id)
        .map(child => assemble(child, new Set(visited)));
      return { node: dev, depth: 0, children };
    };

    const setDepth = (item, depth = 0) => {
      if (!item) return null;
      return {
        ...item,
        depth,
        children: Array.isArray(item.children) ? item.children.map(c => setDepth(c, depth + 1)).filter(Boolean) : [],
      };
    };

    const roots = zoneDevs.filter(d => !d.parent_id || !devMap[d.parent_id]);
    return roots.map(r => assemble(r)).map(r => setDepth(r, 0)).filter(Boolean);
  }, [byZone]);

  const addLog = useCallback((type, message, deviceId = null) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setLogs(prev => [...prev, { ts, type, message, deviceId }].slice(-100));
  }, []);

  const displayedLogs = useMemo(() => {
    if (!selectedId) return logs;
    const devId = selectedDevice?._id || selectedDevice?.id || selectedId || '';
    const devName = selectedDevice?.name || '';
    const devIp = selectedDevice?.ipAddress || selectedDevice?.ip_address || '';

    return logs.filter(log => {
      if (log.deviceId) return log.deviceId === selectedId;
      return (devId && (log.message.includes(devId) || log.message.includes(devId.slice(-6)))) ||
             (devName && log.message.includes(devName)) ||
             (devIp && log.message.includes(devIp));
    });
  }, [logs, selectedId, selectedDevice]);

  const SIM_KEY = import.meta.env.VITE_SIMULATOR_API_KEY || 'ics-guard-simulator-secret-key-2026';
  const SIM_HEADERS = {
    'x-simulator-api-key': SIM_KEY,
    'Content-Type': 'application/json',
  };

  const fetchDevices = useCallback(async (isInit = false) => {
    try {
      if (isInit) setLoading(true);
      let list = [];
      try {
        const res = await hardwareApi.get('/devices?per_page=1000');
        list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        try {
          const r = await fetch('/hardware-api/devices?per_page=1000', { headers: SIM_HEADERS });
          if (r.ok) {
            const res2 = await r.json();
            list = Array.isArray(res2) ? res2 : (Array.isArray(res2?.data) ? res2.data : []);
          } else {
            const r2 = await fetch('/api/devices?per_page=1000', { headers: SIM_HEADERS });
            const res3 = await r2.json();
            list = Array.isArray(res3) ? res3 : (Array.isArray(res3?.data) ? res3.data : []);
          }
        } catch (err2) {
          addLog('error', `Không thể kết nối Hardware BFF / Backend API: ${err2.message}`);
        }
      }
      
      const connectedDevices = list
        .map(normalizeDevice)
        .filter(Boolean);
      setDevices(connectedDevices);
    } catch (e) {
      addLog('error', 'Không thể tải danh sách thiết bị từ Backend.');
    } finally {
      if (isInit) setLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    fetchDevices(true);
    addLog('system', 'ICS-Guard Physical Simulator đã sẵn sàng.');
    addLog('system', 'Kết nối Mosquitto MQTT Broker TLS :8883 | InfluxDB :8086 OK.');

    const handleDeviceSync = (data) => {
      fetchDevices();
      if (data?.action === 'decommission') {
        addLog('warning', `[DEVICE_SYNC] Thiết bị "${data.device?.name || data.device_id}" đã bị XÓA MỀM từ Device Management (Chờ xóa cứng).`);
      } else if (data?.action === 'restore') {
        addLog('success', `[DEVICE_SYNC] Thiết bị "${data.device?.name || data.device_id}" đã KHÔI PHỤC từ Device Management (Hoạt động bình thường).`);
      } else if (data?.action === 'delete') {
        addLog('unplug', `[DEVICE_SYNC] Thiết bị "${data.device_id}" đã XÓA CỨNG vĩnh viễn khỏi hệ thống.`);
      } else if (data?.action === 'attack') {
        addLog('warning', `[⚠️ TẤN CÔNG] Thiết bị "${data.device?.name || data.device_id}" đang bị tấn công (${data.attack_type || 'UNKNOWN'}) — Đã chuyển sang trạng thái QUARANTINED!`, data.device_id);
      } else if (data?.action === 'approved') {
        addLog('success', `[✅ ĐÃ DUYỆT] Thiết bị "${data.device?.name || data.device_id}" đã được DUYỆT bởi Admin — Bắt đầu nhận telemetry và log.`);
      } else if (data?.action === 'create') {
        addLog('system', `[DEVICE_SYNC] Thiết bị mới "${data.device?.name || data.device_id}" đã được thêm — Đang CHỜ DUYỆT từ Device Management.`);
      }
    };

    const handleDeviceStatusChanged = (deviceData) => {
      if (!deviceData) return;
      const deviceId = String(deviceData._id || deviceData.id || '');
      if (!deviceId) return;
      const normalized = normalizeDevice(deviceData);
      if (!normalized) return;
      // Inline update: replace matching device in state; no-op if not found (fetchDevices will handle it)
      setDevices(prev => {
        const exists = prev.some(d => String(d._id) === deviceId);
        if (exists) {
          return prev.map(d => String(d._id) === deviceId ? { ...d, ...normalized } : d);
        }
        return prev;
      });
    };

    const handleHardwareLogStream = (logData) => {
      if (!logData) return;
      const typeMap = {
        'CRITICAL': 'warning',
        'HIGH': 'warning',
        'ERROR': 'error',
        'ATTACK_STOPPED': 'success',
        'INFO': 'system'
      };
      const type = typeMap[logData.log_level] || typeMap[logData.event] || 'warning';
      addLog(type, `[RAW LOG] ${logData.device_name || logData.device_id || 'UNKNOWN'}: ${logData.message || logData.event}`);
    };

    socket.on('DEVICE_SYNC', handleDeviceSync);
    socket.on('DEVICE_STATUS_CHANGED', handleDeviceStatusChanged);
    socket.on('HARDWARE_LOG_STREAM', handleHardwareLogStream);

    return () => {
      socket.off('DEVICE_SYNC', handleDeviceSync);
      socket.off('DEVICE_STATUS_CHANGED', handleDeviceStatusChanged);
      socket.off('HARDWARE_LOG_STREAM', handleHardwareLogStream);
    };
  }, [fetchDevices, addLog]);

  useEffect(() => {
    if (devices.length === 0) return;
    const timer = setInterval(() => {
      const activeDevs = devices.filter(d => d.status !== 'isolated' && d.status !== 'offline' && d.status !== 'decommissioned' && d.approval_status !== 'pending' && d.approval_status !== 'rejected');
      if (!activeDevs.length) return;

      activeDevs.forEach(d => {
        const t = d.node_type || d.type;
        let payload = '';
        if (t === 'sensor' || t?.startsWith('sensor_')) {
          payload = `temperature=${(Math.random() * 15 + 20).toFixed(1)}°C, humidity=${(Math.random() * 40 + 40).toFixed(0)}%`;
        } else if (t === 'actuator' || t === 'pump' || t === 'motor' || t === 'breaker') {
          payload = `valve_position=${Math.floor(Math.random() * 100)}%, flow_rate=${(Math.random() * 5).toFixed(2)}L/s`;
        } else if (t === 'controller' || t === 'rtu' || t === 'dcs') {
          payload = `cpu_cycle=OB1, scan_time=${Math.floor(Math.random() * 8) + 2}ms, mem_ok=true`;
        } else {
          payload = `ping_rtt=1ms, pkts=64B, uptime=${Math.floor(Math.random() * 9999)}s`;
        }

        if (selectedId) {
          if (d._id === selectedId || d.id === selectedId) {
            addLog('telemetry', `PUBLISH ics/telemetry/${d.zone}/${d._id?.slice(-6)} | ${payload}`, d._id);
          }
        } else {
          if (Math.random() < 0.3) {
            addLog('telemetry', `PUBLISH ics/telemetry/${d.zone}/${d._id?.slice(-6)} | ${payload}`, d._id);
          }
        }
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [devices, selectedId, addLog]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const savePositions = useCallback((newPos) => {
    setPositions(newPos);
    localStorage.setItem('sim_positions_v2', JSON.stringify(newPos));
  }, []);

  useEffect(() => {
    if (!devices.length) return;
    let currentPos = {};
    try {
      const stored = JSON.parse(localStorage.getItem('sim_positions_v2') || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) currentPos = stored;
    } catch (err) {
      localStorage.removeItem('sim_positions_v2');
    }
    const merged = { ...currentPos };
    let changed = false;

    allZones.forEach(zone => {
      const zoneDevs = devices.filter(d => (d.zone || 'Zone-A') === zone.id);
      const unpositioned = zoneDevs.filter(d => !merged[d._id]);
      if (!unpositioned.length) return;

      const layout = computeHierarchicalLayout(zoneDevs);
      Object.entries(layout).forEach(([id, pos]) => {
        if (!merged[id]) { merged[id] = pos; changed = true; }
      });
    });

    if (changed) savePositions(merged);
  }, [devices, allZones, savePositions]);

  const handleAutoLayout = useCallback(() => {
    const newPos = {};
    allZones.forEach(zone => {
      const zoneDevs = devices.filter(d => (d.zone || 'Zone-A') === zone.id);
      const layout = computeHierarchicalLayout(zoneDevs);
      Object.assign(newPos, layout);
    });
    savePositions(newPos);
    addLog('info', 'Đã tự động sắp xếp lại vị trí thiết bị trên canvas.');
  }, [devices, savePositions, addLog]);

  const layoutForZone = useCallback((zoneId) => {
    const devs = byZone[zoneId] || [];
    return devs.map(d => ({
      ...d,
      cx: positions[d._id]?.x ?? (PAD_L + NODE_W / 2),
      cy: positions[d._id]?.y ?? PAD_TOP,
    }));
  }, [byZone, positions]);

  const cablesForZone = useCallback((zoneId, laid) => {
    const map = Object.fromEntries(laid.map(n => [n._id, n]));
    return laid
      .filter(n => n.parent_id && map[n.parent_id])
      .map(n => {
        const p = map[n.parent_id];
        return {
          id: `${p._id}-${n._id}`,
          x1: p.cx, y1: p.cy + 18,
          x2: n.cx, y2: n.cy - 18,
          status: n.status, parentStatus: p.status
        };
      });
  }, []);

  const triggerOverheat = (zoneId) => {
    addLog('error', `[SỰ CỐ QUÁ NHIỆT] Nhiệt độ phòng máy tại ${zoneId} vọt lên 95°C. Cảnh báo nguy cơ nổ/hỏng phần cứng!`);
    toast.error(`[SỰ CỐ QUÁ NHIỆT] Vùng ${zoneId} đang gặp sự cố nhiệt độ môi trường vượt ngưỡng 95°C!`);
  };

  const triggerPowerOutage = async (zoneId) => {
    addLog('error', `[SỰ CỐ MẤT ĐIỆN] Mất nguồn điện diện rộng tại phân vùng ${zoneId}. Toàn bộ thiết bị mất kết nối!`);
    toast.error(`[SỰ CỐ MẤT ĐIỆN] Phân vùng ${zoneId} bị ngắt nguồn điện!`);
    const zoneDevs = devices.filter(d => (d.zone || 'Zone-A') === zoneId);
    for (const d of zoneDevs) {
      try {
        await hardwareApi.patch(`/devices/${encodeURIComponent(d._id)}/operational-status`, { status: 'offline', operational_status: 'offline' });
      } catch (e) {}
    }
    fetchDevices();
  };

  const triggerWaterLeak = (zoneId) => {
    addLog('error', `[SỰ CỐ RÒ RỈ CHẤT LỎNG] Phát hiện rò rỉ nước/hóa chất nghiêm trọng tại ${zoneId}. Cảm biến ngập nước báo mức kịch trần.`);
    toast.error(`[SỰ CỐ RÒ RỈ CHẤT LỎNG] Cảnh báo rò rỉ chất lỏng tại vùng ${zoneId}!`);
  };

  const triggerValveJam = (deviceId) => {
    const dev = deviceMap[deviceId];
    addLog('error', `[HỎNG CƠ KHÍ] Van chấp hành ${dev?.name || deviceId} bị kẹt cơ khí. Sai lệch chỉ số điều khiển (Phản hồi 20% vs Lệnh 100%).`);
    toast.error(`[HỎNG CƠ KHÍ] Thiết bị ${dev?.name || deviceId} gặp sự cố kẹt cơ khí!`);
  };

  const triggerCableCut = (deviceId) => {
    const dev = deviceMap[deviceId];
    addLog('error', `[ĐỨT CÁP MẠNG] Phát hiện sự cố đứt cáp mạng vật lý hoặc hỏng cổng truyền dẫn tại thiết bị ${dev?.name || deviceId}.`);
    toast.error(`[ĐỨT CÁP MẠNG] Đã ngắt kết nối cáp mạng vật lý thiết bị ${dev?.name || deviceId}!`);
  };

  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    setDragNodeId(node._id);
    const pos = positions[node._id] || { x: node.cx, y: node.cy };
    dragOffset.current = {
      x: e.clientX / canvasScale - pos.x,
      y: e.clientY / canvasScale - pos.y,
    };
  };

  const handleCanvasMouseMove = (e, zoneEl) => {
    if (!dragNodeId || !zoneEl) return;
    const rect = zoneEl.getBoundingClientRect();
    const minX = CM_2_PX + NODE_W / 2;
    const minY = CM_2_PX + NODE_H / 2;
    const maxX = (rect.width) / canvasScale - (CM_2_PX + NODE_W / 2);
    const maxY = (rect.height) / canvasScale - (CM_2_PX + NODE_H / 2);
    const x = Math.max(minX, Math.min(maxX, (e.clientX - rect.left) / canvasScale));
    const y = Math.max(minY, Math.min(maxY, (e.clientY - rect.top) / canvasScale));
    savePositions({ ...positions, [dragNodeId]: { x, y } });
  };

  const handleCanvasMouseUp = () => setDragNodeId(null);
  const handleCanvasBlankClick = useCallback((e) => {
    const target = e.target;
    if (!target?.closest) return;
    if (target.closest('.canvas-node, .zone-label, button, input, select, textarea, a')) return;
    setSelectedId(null);
  }, []);

  const handlePanMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.canvas-node, .zoom-controls, button, input, select, textarea, a')) return;

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvasScrollRef.current ? canvasScrollRef.current.scrollLeft : 0,
      scrollTop: canvasScrollRef.current ? canvasScrollRef.current.scrollTop : 0,
    };
  };

  const handlePanMouseMove = (e) => {
    if (dragNodeId) return;
    if (!isPanning || !canvasScrollRef.current) return;

    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;

    canvasScrollRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    canvasScrollRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handlePanMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheelZoom = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setCanvasScale(prev => {
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      return Math.max(0.25, Math.min(1.5, parseFloat((prev + delta).toFixed(2))));
    });
  }, []);

  const handleTemplateDragStart = (tpl) => setDragTemplate(tpl);
  const handleZoneDragOver = (e, zoneId) => { e.preventDefault(); setDragOverZone(zoneId); };
  const handleZoneDragLeave = () => setDragOverZone(null);

  const handleZoneDrop = (e, zoneId) => {
    e.preventDefault();
    setDragOverZone(null);
    if (!dragTemplate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    openAddModal(dragTemplate.type, zoneId, { x: dropX, y: dropY });
    setDragTemplate(null);
  };

  const openAddModal = (nodeType, zone = 'Zone-A', dropPos = null) => {
    const meta = TYPE_META[nodeType] || TYPE_META.sensor;
    const ip = generateIp(zone, existingIps);
    const mac = generateMac();
    setModal({
      type: 'add',
      form: {
        name: '',
        node_type: nodeType,
        zone,
        ipAddress: ip,
        macAddress: mac,
        parent_id: '',
        hardware_model: meta.hw,
        firmware_version: meta.fw,
        icon_path: meta.icon,
      },
      dropPos,
    });
  };

  const openAddChildModal = (parentDevice) => {
    const parentType = parentDevice.node_type || parentDevice.type;
    const compatibleTypes = DEVICE_TYPES.filter(t => canParent(parentType, t.type));
    const defaultChildType = compatibleTypes.length > 0 ? compatibleTypes[0].type : 'sensor';
    const meta = TYPE_META[defaultChildType] || TYPE_META.sensor;
    const zone = parentDevice.zone || 'Zone-A';
    setModal({
      type: 'add',
      form: {
        name: '',
        node_type: defaultChildType,
        zone,
        ipAddress: generateIp(zone, existingIps),
        macAddress: generateMac(),
        parent_id: parentDevice._id,
        hardware_model: meta.hw,
        firmware_version: meta.fw,
        icon_path: meta.icon,
      },
    });
  };

  const handleQuickPresetFill = () => {
    if (!modal?.form) return;
    const meta = TYPE_META[modal.form.node_type] || TYPE_META.sensor;
    const zone = modal.form.zone || 'Zone-A';
    const zoneDevs = devices.filter(d => (d.zone || 'Zone-A') === zone);
    
    let defaultParent = modal.form.parent_id || '';
    if (!defaultParent && meta.needsParent) {
      const candidateParent = zoneDevs.find(d => canParent(d.node_type || d.type, modal.form.node_type));
      if (candidateParent) defaultParent = candidateParent._id;
    }

    setModal(prev => ({
      ...prev,
      form: {
        ...prev.form,
        name: `${meta.label} #${Math.floor(Math.random() * 89) + 10}`,
        ipAddress: generateIp(zone, existingIps),
        macAddress: generateMac(),
        parent_id: defaultParent,
        hardware_model: meta.hw,
        firmware_version: meta.fw,
      }
    }));
    toast.success('Đã nạp bộ cấu hình chuẩn cho thiết bị!');
  };

  const openDeleteModal = (node) => {
    const children = devices.filter(d => d.parent_id === node._id);
    setModal({ type: 'delete', node, children });
  };

  const handleAddDevice = async () => {
    const { form, dropPos } = modal;
    if (!form.name.trim()) { toast.error('Vui lòng điền tên thiết bị.'); return; }

    const meta = TYPE_META[form.node_type];
    if (meta?.needsParent && !form.parent_id) {
      toast.error(`Thiết bị loại "${meta?.label || form.node_type}" cần chọn một Parent (Gateway/Controller).`);
      return;
    }

    if (form.parent_id) {
      const parent = deviceMap[form.parent_id];
      if (parent && !canParent(parent.node_type || parent.type, form.node_type)) {
        toast.error(`Loại thiết bị "${meta?.label || form.node_type}" không phù hợp làm con của "${parent.name}" (${parent.node_type || parent.type}).`);
        return;
      }
    }

    try {
      let createdDevice = null;
      try {
        const res = await hardwareApi.post('/devices', { ...form });
        createdDevice = res?.device || res?.data || res;
      } catch (apiErr) {
        const r = await fetch('/hardware-api/devices', {
          method: 'POST',
          headers: SIM_HEADERS,
          body: JSON.stringify({ ...form }),
        });
        if (r.ok) {
          const res2 = await r.json();
          createdDevice = res2?.device || res2?.data || res2;
        } else {
          const r2 = await fetch('/api/devices', {
            method: 'POST',
            headers: SIM_HEADERS,
            body: JSON.stringify({ ...form }),
          });
          if (r2.ok) {
            const res3 = await r2.json();
            createdDevice = res3?.device || res3?.data || res3;
          } else {
            const errJson = await r2.json().catch(() => ({}));
            throw new Error(errJson.message || apiErr.response?.data?.message || 'Không thể tạo thiết bị.');
          }
        }
      }

      if (createdDevice) {
        const newId = createdDevice._id || createdDevice.id;
        if (dropPos) savePositions({ ...positions, [newId]: dropPos });
        toast.success(`Cắm nóng "${form.name}" thành công! Đang chờ duyệt.`);
        addLog('success', `PLUG [${form.node_type.toUpperCase()}] "${form.name}" @ ${form.ipAddress} → Zone ${form.zone} (Chờ duyệt)`, newId);
        setModal(null);
        fetchDevices();
      }
    } catch (err) {
      console.error('[handleAddDevice error]:', err);
      toast.error(err.message || err.response?.data?.message || 'Lỗi khi thêm thiết bị.');
    }
  };

  const handleDisconnectDevice = async (node) => {
    const targetNode = node || modal?.node;
    if (!targetNode) return;
    const targetId = typeof targetNode._id === 'object' ? (targetNode._id?.$oid || targetNode._id?.toString()) : (targetNode._id || targetNode.id);
    const payload = { operational_status: 'offline', status: 'offline' };
    try {
      try {
        await hardwareApi.patch(`/devices/${encodeURIComponent(targetId)}/operational-status`, payload);
      } catch (apiErr) {
        const r = await fetch(`/api/devices/${encodeURIComponent(targetId)}/operational-status`, {
          method: 'PATCH',
          headers: SIM_HEADERS,
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw apiErr;
      }
      toast.success(`Đã ngắt kết nối "${targetNode.name}". Thiết bị đã chuyển sang trạng thái Offline.`);
      addLog('unplug', `UNPLUG "${targetNode.name}" (${targetNode.ipAddress || targetNode.ip_address || ''}) — Chuyển sang Offline.`, targetId);
      setModal(null);
      fetchDevices();
    } catch (err) {
      console.error('[handleDisconnectDevice error]:', err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi ngắt kết nối thiết bị.');
    }
  };

  const handleDeleteDevice = async () => {
    if (!modal?.node) return;
    const { node } = modal;
    const targetId = typeof node._id === 'object' ? (node._id?.$oid || node._id?.toString()) : (node._id || node.id);
    if (!window.confirm(`XÁC NHẬN XÓA CỨNG: Bạn có chắc chắn muốn XÓA CỨNG VĨNH VIỄN thiết bị "${node.name}" khỏi toàn bộ hệ thống?`)) return;
    try {
      try {
        await hardwareApi.delete(`/devices/${encodeURIComponent(targetId)}?hard_delete=true`);
      } catch (apiErr) {
        const r = await fetch(`/hardware-api/devices/${encodeURIComponent(targetId)}?hard_delete=true`, {
          method: 'DELETE',
          headers: SIM_HEADERS,
        });
        if (!r.ok) {
          const r2 = await fetch(`/api/devices/${encodeURIComponent(targetId)}?hard_delete=true`, {
            method: 'DELETE',
            headers: SIM_HEADERS,
          });
          if (!r2.ok) throw apiErr;
        }
      }
      toast.success(`Đã xóa cứng và giải phóng vĩnh viễn thiết bị "${node.name}".`);
      addLog('unplug', `HARD DELETE "${node.name}" (${node.ipAddress || node.ip_address || ''}) — Đã xóa cứng vĩnh viễn khỏi hệ thống.`, targetId);
      setModal(null);
      fetchDevices();
    } catch (err) {
      console.error('[handleDeleteDevice error]:', err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi giải phóng/xóa cứng thiết bị.');
    }
  };

  const handleReconnectDevice = async (node) => {
    if (!node) return;
    const targetId = typeof node._id === 'object' ? (node._id?.$oid || node._id?.toString()) : (node._id || node.id);
    const payload = { operational_status: 'online', status: 'online' };
    try {
      try {
        await hardwareApi.patch(`/devices/${encodeURIComponent(targetId)}/operational-status`, payload);
      } catch (apiErr) {
        const r = await fetch(`/api/devices/${encodeURIComponent(targetId)}/operational-status`, {
          method: 'PATCH',
          headers: SIM_HEADERS,
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw apiErr;
      }
      toast.success(`Đã cắm lại dây mạng cho "${node.name}". Thiết bị đang online.`);
      addLog('success', `RECONNECT "${node.name}" (${node.ipAddress || node.ip_address || ''}) — Chuyển sang Online.`, targetId);
      fetchDevices();
    } catch (err) {
      console.error('[handleReconnectDevice error]:', err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi khi kết nối lại thiết bị.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm || !selectedDevice) return;
    setSavingEdit(true);
    const targetId = selectedDevice._id || selectedDevice.id;
    try {
      await hardwareApi.put(`/devices/${encodeURIComponent(targetId)}`, editForm);
      toast.success('Lưu cấu hình thành công!');
      addLog('info', `Cập nhật cấu hình thiết bị "${editForm.name}"`, targetId);
      fetchDevices();
    } catch (err) {
      toast.error('Lỗi khi lưu cấu hình.');
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    if (selectedDevice) {
      setEditForm({
        name: selectedDevice.name || '',
        hardware_model: selectedDevice.hardware_model || '',
        firmware_version: selectedDevice.firmware_version || '',
      });
    } else {
      setEditForm(null);
    }
  }, [selectedDevice]);

  const activeCount = useMemo(() => devices.filter(d => d.status === 'active' || d.status === 'online').length, [devices]);

  const renderTreeNode = (treeItem) => {
    if (!treeItem || !treeItem.node) return null;
    const { node, depth = 0, children = [] } = treeItem;
    const isSelected = selectedId === node._id;
    const isCollapsed = nodeCollapsed[node._id];
    const hasChildren = children.length > 0;
    const meta = TYPE_META[node.node_type || node.type] || TYPE_META.sensor;
    const reachable = isDeviceReachable(node._id);
    const status = !reachable ? 'offline' : (node.status || 'active');

    return (
      <div key={node._id} className="tree-node-wrapper">
        <div
          className={`tree-node-item ${isSelected ? 'selected' : ''} status-${status}`}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
          onClick={() => scrollToDeviceOnCanvas(node._id)}
        >
          {hasChildren ? (
            <button
              className="tree-chevron-btn"
              onClick={(e) => {
                e.stopPropagation();
                setNodeCollapsed(p => ({ ...p, [node._id]: !p[node._id] }));
              }}
            >
              <ChevronRight
                size={12}
                className={`tree-chevron${isCollapsed ? '' : ' open'}`}
              />
            </button>
          ) : (
            <span className="tree-leaf-dot" />
          )}

          <div
            className="tree-node-icon"
            style={{
              background: `${meta.color}15`,
              borderColor: `${meta.color}35`,
              color: meta.color
            }}
          >
            {getIcon(node.icon_path || meta.icon, 'sm')}
          </div>

          <div className="tree-node-info">
            <span className="tree-node-name">{node.name}</span>
            <span className="tree-node-ip">{node.ipAddress || node.ip_address}</span>
          </div>

          <span className={`tree-status-led ${status}`} title={`Status: ${status}`} />

          <div className="tree-node-hover-actions">
            {meta.canBeParent && (
              <button
                className="action-btn add"
                title="Thêm thiết bị con"
                onClick={e => { e.stopPropagation(); openAddChildModal(node); }}
              >
                <Plus size={10} />
              </button>
            )}
            <button
              className="action-btn del"
              title="Ngắt kết nối"
              onClick={e => { e.stopPropagation(); openDeleteModal(node); }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>

        {!isCollapsed && hasChildren && (
          <div className="tree-children">
            {children.map(c => renderTreeNode(c))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="hardware-simulator sim-root">
      {/* ===== HEADER ===== */}
      <header className="sim-header">
        <div className="sim-header-brand">
          <div className="brand-icon">
            <Server size={20} />
          </div>
          <h1>ICS-Guard Physical Hardware Simulator</h1>
          <span className="mode-pill">PHYSICAL TWIN</span>
        </div>

        <div className="sim-header-status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-dot online" />
            <span>Node Online: <strong className="node-count">{activeCount}</strong> / {devices.length}</span>
          </div>
          <button className="icon-btn" onClick={() => fetchDevices(true)} title="Tải lại">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* ===== BODY: 3 panels ===== */}
      <div className="sim-body">
        {/* LEFT: IoT Tree Panel */}
        <aside className="sim-tree-panel">
          <div className="tree-panel-header">
            <div className="header-top-row">
              <h2>
                <Layers size={13} style={{ color: '#38bdf8' }} />
                IoT Device Tree
                <span className="tree-badge">{devices.length}</span>
              </h2>
              <button className="btn-add-root" onClick={() => openAddModal('gateway')}>
                <Plus size={11} /> Gateway
              </button>
            </div>
          </div>

          <div className="tree-scroll">
            {allZones.map(zone => {
              const tree = buildTree(zone.id);
              const collapsed = zoneCollapsed[zone.id];
              const zoneDevCount = byZone[zone.id]?.length || 0;

              return (
                <div key={zone.id} className="tree-zone-group">
                  <div
                    className="tree-zone-label"
                    onClick={() => setZoneCollapsed(p => ({ ...p, [zone.id]: !p[zone.id] }))}
                  >
                    <div className="zone-title-area">
                      <ChevronRight
                        size={12}
                        className={`zone-chevron${collapsed ? '' : ' open'}`}
                      />
                      <span style={{ color: zone.color }}>{zone.id}</span>
                    </div>
                    <span className="zone-count-badge">{zoneDevCount} nodes</span>
                  </div>

                  {!collapsed && (
                    tree.length === 0 ? (
                      <div style={{ padding: '8px 14px', fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
                        Chưa có thiết bị
                      </div>
                    ) : (
                      tree.map(n => renderTreeNode(n))
                    )
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER: Topology Canvas */}
        <main className="sim-canvas-wrapper">
          {/* Floating Zoom controls fixed at canvas top-right corner */}
          <div className="zoom-controls">
            <button
              className="zoom-btn"
              onClick={() => setCanvasScale(p => Math.min(1.5, parseFloat((p + 0.1).toFixed(2))))}
              title="Phóng to (Ctrl+Scroll)"
            >+</button>
            <span className="zoom-pct" onClick={() => setCanvasScale(1.0)} title="Reset về 100%">
              {Math.round(canvasScale * 100)}%
            </span>
            <button
              className="zoom-btn"
              onClick={() => setCanvasScale(p => Math.max(0.25, parseFloat((p - 0.1).toFixed(2))))}
              title="Thu nhỏ (Ctrl+Scroll)"
            >−</button>
            <button
              className="zoom-btn layout-btn"
              onClick={handleAutoLayout}
              title="Tự động sắp xếp lại"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <div
            className={`sim-canvas-scroll ${isPanning ? 'panning' : ''}`}
            ref={canvasScrollRef}
            onWheel={handleWheelZoom}
            onClick={handleCanvasBlankClick}
            onMouseDown={handlePanMouseDown}
            onMouseMove={handlePanMouseMove}
            onMouseUp={handlePanMouseUp}
            onMouseLeave={handlePanMouseUp}
          >
            <div
              className="sim-canvas"
              style={{ transform: `scale(${canvasScale})`, transformOrigin: 'top left' }}
            >
              {allZones.map(zone => {
                const laid = layoutForZone(zone.id);
                const cables = cablesForZone(zone.id, laid);
                const isOver = dragOverZone === zone.id;

                const maxX = Math.max(750, ...laid.map(n => n.cx + NODE_W / 2 + CM_2_PX));
                const maxY = Math.max(400, ...laid.map(n => n.cy + NODE_H / 2 + CM_2_PX));

                return (
                  <div
                    key={zone.id}
                    className={`zone-row ${zone.cssClass} ${isOver ? 'drag-over' : ''}`}
                    style={{
                      width: `${maxX}px`,
                      minHeight: `${maxY}px`,
                    }}
                    onDragOver={e => handleZoneDragOver(e, zone.id)}
                    onDragLeave={handleZoneDragLeave}
                    onDrop={e => handleZoneDrop(e, zone.id)}
                  >
                    <div className="zone-label" style={{ color: zone.color }}>
                      {zone.label}
                    </div>

                    {/* SVG cables */}
                    <svg className="zone-svg">
                      <defs>
                        <linearGradient id="cableGrad-normal" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.9" />
                        </linearGradient>
                        <linearGradient id="cableGrad-offline" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#991b1b" stopOpacity="0.8" />
                        </linearGradient>
                      </defs>

                      {cables.map(c => {
                        const isOff = c.status === 'offline' || c.parentStatus === 'offline';
                        const isIso = c.status === 'isolated' || c.parentStatus === 'isolated';
                        const isDanger = isOff || isIso;
                        const cy1 = c.y1 + (c.y2 - c.y1) * 0.45;
                        const cy2 = c.y1 + (c.y2 - c.y1) * 0.55;
                        const pathD = `M ${c.x1} ${c.y1} C ${c.x1} ${cy1}, ${c.x2} ${cy2}, ${c.x2} ${c.y2}`;

                        return (
                          <g key={c.id}>
                            {/* Glow layer */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke={isDanger ? '#ef4444' : '#ffffff'}
                              strokeWidth={4}
                              strokeOpacity={0.15}
                              strokeLinecap="round"
                            />
                            {/* Main cable line */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke={isDanger ? 'url(#cableGrad-offline)' : 'url(#cableGrad-normal)'}
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeDasharray={isDanger ? '4 3' : undefined}
                              strokeOpacity={isDanger ? 0.8 : 1}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {/* Canvas Nodes */}
                    {laid.map(node => {
                      const isSelected = selectedId === node._id;
                      const isDragging = dragNodeId === node._id;
                      const meta = TYPE_META[node.node_type || node.type] || TYPE_META.sensor;
                      const reachable = isDeviceReachable(node._id);
                      const isOffline = !reachable || node.status === 'offline';
                      const isIsolated = node.status === 'isolated';
                      const isQuarantined = node.status === 'quarantined';
                      const isDecommissioned = node.status === 'decommissioned' || node.approval_status === 'rejected';
                      const isPending = node.approval_status === 'pending' && !isDecommissioned;

                      return (
                        <div
                          key={node._id}
                          data-node-id={node._id}
                          className={`canvas-node ${isDecommissioned ? 'status-decommissioned' : isPending ? 'status-pending' : isOffline ? 'status-offline' : isIsolated ? 'status-isolated' : isQuarantined ? 'status-quarantined' : 'status-active'} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                          style={{
                            left: `${node.cx}px`,
                            top: `${node.cy}px`,
                            opacity: isDecommissioned ? 0.7 : isPending ? 0.75 : 1,
                          }}
                          onMouseDown={e => handleNodeMouseDown(e, node)}
                          onMouseMove={e => handleCanvasMouseMove(e, e.currentTarget.closest('.zone-row'))}
                          onMouseUp={handleCanvasMouseUp}
                          onClick={e => { e.stopPropagation(); setSelectedId(node._id); }}
                        >
                          <div className="canvas-node-body">
                            {isQuarantined && <div className="attack-pulse" />}
                            <span className={`node-status-ring ${
                              isDecommissioned ? 'offline' :
                              isPending ? 'pending' :
                              isOffline ? 'offline' :
                              isIsolated ? 'isolated' :
                              isQuarantined ? 'quarantined' :
                              'active'
                            }`} />

                            <div className="node-icon-wrap" style={{ background: `${meta.color}15`, borderColor: isPending ? 'rgba(234,179,8,0.4)' : `${meta.color}35`, color: isPending ? '#eab308' : meta.color }}>
                              {getIcon(node.icon_path || meta.icon)}
                            </div>

                            <div className="node-name">{node.name}</div>
                            <div className="node-ip-badge">{node.ipAddress || node.ip_address}</div>

                            {isPending && (
                              <div style={{ marginTop: 2, background: 'rgba(234,179,8,0.2)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 4, padding: '1px 4px', fontSize: 9, fontWeight: 700 }}>
                                CHỜ DUYỆT
                              </div>
                            )}
                            {isDecommissioned && (
                              <div style={{ marginTop: 2, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 4, padding: '1px 4px', fontSize: 9, fontWeight: 700 }}>
                                CHỜ XÓA CỨNG
                              </div>
                            )}

                            <div className="node-hover-actions">
                              {meta.canBeParent && !isDecommissioned && (
                                <button
                                  className="btn-add-child"
                                  title="Thêm thiết bị con"
                                  onClick={e => { e.stopPropagation(); openAddChildModal(node); }}
                                >
                                  <Plus size={10} />
                                </button>
                              )}
                              <button
                                className="btn-remove"
                                title={isDecommissioned ? 'Rút phần cứng (Xóa cứng)' : 'Xóa / Ngắt kết nối'}
                                onClick={e => { e.stopPropagation(); openDeleteModal(node); }}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* RIGHT: Config Panel (Opens when a device is selected, closes when deselected) */}
        {selectedDevice && (
          <aside className="sim-config-panel">
            <div className="config-panel-header">
              <h2>Device Config</h2>
              <button className="btn-close-config" title="Đóng bảng cấu hình" onClick={() => setSelectedId(null)}>
                <X size={14} />
              </button>
            </div>

            <div className="config-scroll">
              <div className="config-device-header">
                <div
                  className="config-device-icon"
                  style={{
                    background: `${TYPE_META[selectedDevice.node_type || selectedDevice.type]?.color || '#64748b'}18`,
                    border: `1px solid ${TYPE_META[selectedDevice.node_type || selectedDevice.type]?.color || '#64748b'}40`,
                    color: TYPE_META[selectedDevice.node_type || selectedDevice.type]?.color || '#94a3b8'
                  }}
                >
                  {getIcon(selectedDevice.icon_path)}
                </div>
                <div className="config-device-name">{selectedDevice.name}</div>
                <div className="config-device-type">{selectedDevice.node_type || selectedDevice.type}</div>
              </div>

              <div className="config-field-group">
                <div className="config-field">
                  <label>IP Address</label>
                  <div className="field-value">{selectedDevice.ipAddress || selectedDevice.ip_address || '—'}</div>
                </div>
                <div className="config-field">
                  <label>MAC Address</label>
                  <div className="field-value">{selectedDevice.macAddress || '—'}</div>
                </div>
                <div className="config-field">
                  <label>Zone</label>
                  <div className="field-value">{selectedDevice.zone || '—'}</div>
                </div>
                <div className="config-field">
                  <label>Trạng thái</label>
                  <span className={`status-badge ${!isDeviceReachable(selectedDevice._id) ? 'offline' : (selectedDevice.status || 'active')}`}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    {selectedDevice.status === 'offline' ? 'Offline' :
                     !isDeviceReachable(selectedDevice._id) ? 'Unreachable' :
                     selectedDevice.status === 'active' ? 'Connected' :
                     selectedDevice.status === 'isolated' ? 'Isolated' : 'Alert'}
                  </span>
                </div>
                {selectedDevice.parent_id && (
                  <div className="config-field">
                    <label>Parent</label>
                    <div className="field-value">{deviceMap[selectedDevice.parent_id]?.name || selectedDevice.parent_id}</div>
                  </div>
                )}
              </div>

              {editForm && (
                <div className="config-field-group">
                  <div className="config-field">
                    <label>Tên thiết bị</label>
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="config-field">
                    <label>Hardware Model</label>
                    <input
                      value={editForm.hardware_model}
                      onChange={e => setEditForm(p => ({ ...p, hardware_model: e.target.value }))}
                    />
                  </div>
                  <div className="config-field">
                    <label>Firmware Version</label>
                    <input
                      value={editForm.firmware_version}
                      onChange={e => setEditForm(p => ({ ...p, firmware_version: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="config-actions">
                <button
                  className="btn-save-config"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                >
                  <Save size={13} />
                  {savingEdit ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
                {selectedDevice.status === 'offline' ? (
                  <button
                    className="btn-reconnect-device"
                    onClick={() => handleReconnectDevice(selectedDevice)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '7px',
                      color: '#6ee7b7',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Power size={13} />
                    Cắm lại dây mạng
                  </button>
                ) : (
                  <button
                    className="btn-delete-device"
                    onClick={() => openDeleteModal(selectedDevice)}
                  >
                    <Trash2 size={13} />
                    Ngắt kết nối vật lý
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ===== TERMINAL LOG ===== */}
      <div className="sim-terminal">
        <div className="terminal-bar">
          <div className="dots">
            <span /><span /><span />
          </div>
          <span className="terminal-title-text">
            physical_telemetry_loop.log
          </span>
          <button className="btn-clear-log" onClick={() => setLogs([])}>clear</button>
        </div>
        <div className="terminal-body">
          {displayedLogs.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
              {selectedDevice ? 'Chưa có dữ liệu log phát sinh cho thiết bị này.' : 'Chưa có dữ liệu log tổng thể.'}
            </div>
          ) : (
            displayedLogs.map((log, i) => (
              <div key={i} className={`log-line type-${log.type}`}>
                <span className="log-ts">[{log.ts}]</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* ===== MODALS ===== */}
      {modal?.type === 'add' && (
        <div className="sim-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="sim-modal">
            <div className="modal-head">
              <h3>Cắm nóng thiết bị mới</h3>
              <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '12px', textAlign: 'right' }}>
                <button
                  onClick={handleQuickPresetFill}
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Zap size={12} /> Cấu Hình Nhanh (Quick Preset)
                </button>
              </div>

              <div className="modal-field">
                <label>Tên thiết bị *</label>
                <input
                  placeholder="VD: PLC Nhánh B, Cảm biến nhiệt độ 3..."
                  value={modal.form.name}
                  onChange={e => setModal(p => ({ ...p, form: { ...p.form, name: e.target.value } }))}
                  autoFocus
                />
              </div>

              {(() => {
                const currentParentDevice = modal.form.parent_id ? deviceMap[modal.form.parent_id] : null;
                const currentParentType = currentParentDevice ? (currentParentDevice.node_type || currentParentDevice.type) : null;

                const filteredTypes = currentParentType
                  ? DEVICE_TYPES.filter(t => canParent(currentParentType, t.type))
                  : DEVICE_TYPES;

                const filteredGroups = filteredTypes.reduce((acc, t) => {
                  if (!acc[t.group]) acc[t.group] = [];
                  acc[t.group].push(t);
                  return acc;
                }, {});

                const candidateParents = devices.filter(d => {
                  if ((d.zone || 'Zone-A') !== modal.form.zone) return false;
                  const parentType = d.node_type || d.type;
                  return canParent(parentType, modal.form.node_type || 'sensor');
                });

                return (
                  <>
                    <div className="modal-field">
                      <label>Loại thiết bị * {currentParentDevice && <small style={{ color: '#38bdf8' }}>(Đã lọc theo {currentParentDevice.name})</small>}</label>
                      <select
                        value={modal.form.node_type}
                        onChange={e => {
                          const nodeType = e.target.value;
                          const meta = TYPE_META[nodeType] || TYPE_META.sensor;
                          setModal(p => ({
                            ...p,
                            form: {
                              ...p.form,
                              node_type: nodeType,
                              hardware_model: meta.hw,
                              firmware_version: meta.fw,
                              icon_path: meta.icon,
                            }
                          }));
                        }}
                      >
                        {Object.entries(filteredGroups).map(([g, types]) => (
                          <optgroup key={g} label={g}>
                            {types.map(t => (
                              <option key={t.type} value={t.type}>{t.label} ({t.hw})</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div className="modal-field">
                      <label>Phân vùng (Zone) *</label>
                      <select
                        value={modal.form.zone}
                        onChange={e => {
                          const zone = e.target.value;
                          setModal(p => ({
                            ...p,
                            form: {
                              ...p.form,
                              zone,
                              ipAddress: generateIp(zone, existingIps),
                              parent_id: '', // Reset parent when changing zone
                            }
                          }));
                        }}
                      >
                        {allZones.map(z => (
                          <option key={z.id} value={z.id}>{z.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="modal-field">
                      <label>Thiết bị cấp trên (Parent)</label>
                      <select
                        value={modal.form.parent_id}
                        onChange={e => {
                          const newParentId = e.target.value;
                          const newParent = newParentId ? deviceMap[newParentId] : null;
                          const newParentType = newParent ? (newParent.node_type || newParent.type) : null;
                          let newNodeType = modal.form.node_type;

                          if (newParentType && !canParent(newParentType, newNodeType)) {
                            const validTypes = DEVICE_TYPES.filter(t => canParent(newParentType, t.type));
                            if (validTypes.length > 0) newNodeType = validTypes[0].type;
                          }

                          const meta = TYPE_META[newNodeType] || TYPE_META.sensor;

                          setModal(p => ({
                            ...p,
                            form: {
                              ...p.form,
                              parent_id: newParentId,
                              node_type: newNodeType,
                              hardware_model: meta.hw,
                              firmware_version: meta.fw,
                              icon_path: meta.icon,
                            }
                          }));
                        }}
                      >
                        <option value="">-- Không chọn (Root Node / Independent) --</option>
                        {candidateParents.map(d => (
                          <option key={d._id} value={d._id}>{d.name} ({d.node_type || d.type})</option>
                        ))}
                      </select>
                    </div>
                  </>
                );
              })()}

              <div className="modal-row">
                <div className="modal-field">
                  <label>IP Address</label>
                  <input
                    value={modal.form.ipAddress}
                    onChange={e => setModal(p => ({ ...p, form: { ...p.form, ipAddress: e.target.value } }))}
                  />
                </div>
                <div className="modal-field">
                  <label>MAC Address</label>
                  <input
                    value={modal.form.macAddress}
                    onChange={e => setModal(p => ({ ...p, form: { ...p.form, macAddress: e.target.value } }))}
                  />
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn-submit" onClick={handleAddDevice}>
                <Plus size={14} /> Cắm nóng thiết bị
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'delete' && (() => {
        const isDecom = modal.node.status === 'decommissioned' || modal.node.approval_status === 'rejected';

        return (
          <div className="sim-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
            <div className="sim-modal danger">
              <div className="modal-head">
                <h3>{isDecom ? 'Xác nhận Rút phần cứng (Xóa cứng vĩnh viễn)' : 'Quản lý kết nối & Giải phóng thiết bị'}</h3>
                <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
              </div>

              <div className="modal-body">
                {isDecom ? (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#fca5a5', lineHeight: 1.6 }}>
                    <AlertTriangle size={16} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#f87171' }} />
                    Thiết bị <strong style={{ color: '#ffffff' }}>"{modal.node.name}"</strong> đã bị <strong>XÓA MỀM</strong> từ Device Management (Đang ngưng nhận log).
                    <br />
                    • Không thể thêm thiết bị con cho thiết bị này.
                    <br />
                    • Bạn chỉ có thể bấm <strong>"Rút phần cứng (Xóa cứng)"</strong> để giải phóng vĩnh viễn khỏi toàn bộ hệ thống.
                  </div>
                ) : (
                  <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                    Bạn muốn thực hiện thao tác nào với thiết bị <strong style={{ color: '#f8fafc' }}>"{modal.node.name}"</strong>?
                  </p>
                )}

                {modal.children.length > 0 && (
                  <div style={{ marginTop: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', color: '#fca5a5' }}>
                    <AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Cảnh báo: Thiết bị này có {modal.children.length} thiết bị con phụ thuộc. Ngắt kết nối hoặc xóa sẽ làm các thiết bị con bị ngắt tín hiệu.
                  </div>
                )}
              </div>

              <div className="modal-foot" style={{ gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn-cancel" onClick={() => setModal(null)}>Hủy</button>
                {!isDecom && (
                  <button 
                    className="btn-cancel" 
                    style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fde047', border: '1px solid rgba(234, 179, 8, 0.4)' }}
                    onClick={() => handleDisconnectDevice(modal.node)}
                  >
                    <WifiOff size={14} /> Ngắt kết nối (Offline)
                  </button>
                )}
                <button className="btn-danger" onClick={handleDeleteDevice}>
                  <Trash2 size={14} /> {isDecom ? 'Rút phần cứng (Xóa cứng vĩnh viễn)' : 'Xóa vĩnh viễn (Giải phóng)'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const HardwareSimulator = () => (
  <SimulatorErrorBoundary>
    <HardwareSimulatorMain />
  </SimulatorErrorBoundary>
);

export default HardwareSimulator;
