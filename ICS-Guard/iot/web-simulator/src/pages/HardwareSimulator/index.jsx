import './HardwareSimulator.scss';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import http from '@/http/clients/api';
import {
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, HardDrive,
  Trash2, Plus, RefreshCw, Server, Wifi, Activity, ChevronRight, X,
  AlertTriangle, CheckCircle, Settings, Save, RotateCcw, Info, Layers,
  Monitor, Database, Shield, Flame, Waves, Bell, Power, Eye,
  GitMerge, Signal, Lock, Siren, Scan, Nfc, BrainCircuit
} from 'lucide-react';
import { toast } from '@/utils/toast';
import socket from '@/services/socket';

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
// group: phân nhóm hiển thị trên toolbar
// ============================================================
const DEVICE_TYPES = [
  // ---- Infrastructure / Network ----
  { group: 'Hạ tầng mạng',
    type: 'gateway',      label: 'Industrial Gateway',    icon: 'Network',    color: '#3b82f6',
    hw: 'Moxa Switch EDS-408A',         fw: '3.5.2',        canBeParent: true,  needsParent: false },
  { group: 'Hạ tầng mạng',
    type: 'scada',        label: 'SCADA Server',           icon: 'Monitor',    color: '#0ea5e9',
    hw: 'Wonderware InTouch 2020',      fw: '20.1.0',       canBeParent: true,  needsParent: false },
  { group: 'Hạ tầng mạng',
    type: 'hmi',          label: 'HMI Terminal',           icon: 'Scan',       color: '#38bdf8',
    hw: 'Siemens KTP900 Basic',         fw: 'V16.0.1',      canBeParent: false, needsParent: false },
  { group: 'Hạ tầng mạng',
    type: 'firewall',     label: 'Industrial Firewall',    icon: 'Shield',     color: '#64748b',
    hw: 'Fortinet FortiGate-60F',       fw: '7.4.2',        canBeParent: true,  needsParent: false },

  // ---- Controllers / PLCs ----
  { group: 'Bộ điều khiển',
    type: 'controller',   label: 'PLC / Controller',       icon: 'Cpu',        color: '#f59e0b',
    hw: 'Siemens S7-1200 PLC',          fw: '4.2.1',        canBeParent: true,  needsParent: false },
  { group: 'Bộ điều khiển',
    type: 'rtu',          label: 'RTU (Remote Terminal)',  icon: 'GitMerge',   color: '#fb923c',
    hw: 'Schneider SCADAPack 350E',     fw: '8.21.0',       canBeParent: true,  needsParent: false },
  { group: 'Bộ điều khiển',
    type: 'dcs',          label: 'DCS Controller',         icon: 'BrainCircuit', color: '#f97316',
    hw: 'Honeywell Experion PKS C300',  fw: 'R510.2',       canBeParent: true,  needsParent: false },

  // ---- Edge / Communication ----
  { group: 'Edge / Comm',
    type: 'chip',         label: 'ESP32 Edge Module',      icon: 'Radio',      color: '#14b8a6',
    hw: 'ESP32-WROOM-32',               fw: 'ESP-IDF v5.1', canBeParent: false, needsParent: true  },
  { group: 'Edge / Comm',
    type: 'opc_server',   label: 'OPC-UA Server',          icon: 'Database',   color: '#06b6d4',
    hw: 'Prosys OPC UA Simulation Srv', fw: '5.4.6',        canBeParent: false, needsParent: true  },
  { group: 'Edge / Comm',
    type: 'protocol_bridge', label: 'Protocol Bridge',     icon: 'Nfc',        color: '#22d3ee',
    hw: 'Moxa MGate MB3480',            fw: '2.8',          canBeParent: false, needsParent: true  },
  { group: 'Edge / Comm',
    type: 'camera',       label: 'IP Camera / Vision',     icon: 'Eye',        color: '#a78bfa',
    hw: 'Axis P3245-V',                 fw: '11.0.4',       canBeParent: false, needsParent: true  },

  // ---- Sensors ----
  { group: 'Cảm biến',
    type: 'sensor',       label: 'Nhiệt độ / Humidity',     icon: 'Thermometer', color: '#db2777',
    hw: 'Honeywell HIH6130',            fw: '1.0.5',        canBeParent: false, needsParent: true  },
  { group: 'Cảm biến',
    type: 'sensor_pressure', label: 'Cảm biến áp suất',      icon: 'Gauge',      color: '#e11d48',
    hw: 'Emerson Rosemount 3051C',      fw: 'v2.1',         canBeParent: false, needsParent: true  },
  { group: 'Cảm biến',
    type: 'sensor_flow',  label: 'Đồng hồ lưu lượng',       icon: 'Waves',      color: '#be185d',
    hw: 'Endress+Hauser Promag 53W',    fw: '3.05.01',      canBeParent: false, needsParent: true  },
  { group: 'Cảm biến',
    type: 'sensor_gas',   label: 'Gas Detector',           icon: 'Flame',      color: '#dc2626',
    hw: 'MSA Ultima X5000',             fw: 'v1.3.0',       canBeParent: false, needsParent: true  },
  { group: 'Cảm biến',
    type: 'sensor_vibration', label: 'Vibration Monitor',  icon: 'Activity',   color: '#c026d3',
    hw: 'SKF Multilog IMx-8',           fw: '2.4.0',        canBeParent: false, needsParent: true  },
  { group: 'Cảm biến',
    type: 'sensor_level', label: 'Level Sensor',           icon: 'Layers',     color: '#9333ea',
    hw: 'VEGAPULS 64 Radar',            fw: '1.3.7',        canBeParent: false, needsParent: true  },

  // ---- Actuators ----
  { group: 'Chấp hành',
    type: 'actuator',     label: 'Valve / Actuator',       icon: 'Wind',       color: '#7c3aed',
    hw: 'Belimo LRB24-3-T',             fw: '2.1.0',        canBeParent: false, needsParent: true  },
  { group: 'Chấp hành',
    type: 'pump',         label: 'Bơm nước / Lưu chất',     icon: 'Droplets',   color: '#2563eb',
    hw: 'Grundfos CR 10-8',             fw: 'v1.2',         canBeParent: false, needsParent: true  },
  { group: 'Chấp hành',
    type: 'motor',        label: 'Motor Drive (VFD)',       icon: 'Zap',        color: '#ca8a04',
    hw: 'ABB ACS880-01-045A-3',         fw: '2.72',         canBeParent: false, needsParent: true  },
  { group: 'Chấp hành',
    type: 'breaker',      label: 'Circuit Breaker',        icon: 'Power',      color: '#16a34a',
    hw: 'Schneider PowerPact H-Frame',  fw: 'v3.0',         canBeParent: false, needsParent: true  },
  { group: 'Chấp hành',
    type: 'alarm',        label: 'Alarm / Siren',          icon: 'Bell',       color: '#ef4444',
    hw: 'Patlite LR7-E',                fw: 'v2.0',         canBeParent: false, needsParent: true  },
];

const TYPE_META = Object.fromEntries(DEVICE_TYPES.map(t => [t.type, t]));

// Group for toolbar display
const DEVICE_GROUPS = DEVICE_TYPES.reduce((acc, t) => {
  if (!acc[t.group]) acc[t.group] = [];
  acc[t.group].push(t);
  return acc;
}, {});

const ICON_MAP = {
  Network: <Network size={18} />,
  Cpu: <Cpu size={18} />,
  Radio: <Radio size={18} />,
  Thermometer: <Thermometer size={18} />,
  Droplets: <Droplets size={18} />,
  Zap: <Zap size={18} />,
  Wind: <Wind size={18} />,
  Gauge: <Gauge size={18} />,
  HardDrive: <HardDrive size={18} />,
  Monitor: <Monitor size={18} />,
  Database: <Database size={18} />,
  Shield: <Shield size={18} />,
  Flame: <Flame size={18} />,
  Waves: <Waves size={18} />,
  Bell: <Bell size={18} />,
  Power: <Power size={18} />,
  Eye: <Eye size={18} />,
  GitMerge: <GitMerge size={18} />,
  Activity: <Activity size={18} />,
  Layers: <Layers size={18} />,
  Scan: <Scan size={18} />,
  Nfc: <Nfc size={18} />,
  BrainCircuit: <BrainCircuit size={18} />,
  Server: <Server size={18} />,
};

const ICON_MAP_SM = {
  Network: <Network size={13} />,
  Cpu: <Cpu size={13} />,
  Radio: <Radio size={13} />,
  Thermometer: <Thermometer size={13} />,
  Droplets: <Droplets size={13} />,
  Zap: <Zap size={13} />,
  Wind: <Wind size={13} />,
  Gauge: <Gauge size={13} />,
  HardDrive: <HardDrive size={13} />,
  Monitor: <Monitor size={13} />,
  Database: <Database size={13} />,
  Shield: <Shield size={13} />,
  Flame: <Flame size={13} />,
  Waves: <Waves size={13} />,
  Bell: <Bell size={13} />,
  Power: <Power size={13} />,
  Eye: <Eye size={13} />,
  GitMerge: <GitMerge size={13} />,
  Activity: <Activity size={13} />,
  Layers: <Layers size={13} />,
  Scan: <Scan size={13} />,
  Nfc: <Nfc size={13} />,
  BrainCircuit: <BrainCircuit size={13} />,
  Server: <Server size={13} />,
};

const getIcon = (iconPath, size = 'md') =>
  (size === 'sm' ? ICON_MAP_SM[iconPath] : ICON_MAP[iconPath]) || (size === 'sm' ? <HardDrive size={13} /> : <HardDrive size={18} />);


// ============================================================
// HELPERS
// ============================================================
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

// Hierarchy depth: 0=gateway, 1=controller, 2=chip/sensor/actuator
const typeDepth = { gateway: 0, controller: 1, chip: 2, sensor: 2, actuator: 2 };

// ---- Các loại thiết bị có thể là parent ----
const PARENT_TYPES    = new Set(['gateway', 'scada', 'firewall', 'controller', 'rtu', 'dcs']);
// ---- Các loại cần parent (endpoint devices) ----
const ENDPOINT_TYPES  = new Set(['sensor', 'sensor_pressure', 'sensor_flow', 'sensor_gas',
                                  'sensor_vibration', 'sensor_level', 'actuator', 'pump',
                                  'motor', 'breaker', 'alarm', 'camera', 'hmi',
                                  'chip', 'opc_server', 'protocol_bridge']);

// Check if parentType can be parent of childType
const canParent = (parentType, childType) => {
  if (!parentType || !childType) return false;
  // infrastructure → can parent everything
  if (['gateway', 'scada', 'firewall'].includes(parentType)) return true;
  // controller-class → can parent endpoint devices
  if (['controller', 'rtu', 'dcs'].includes(parentType)) return ENDPOINT_TYPES.has(childType);
  return false;
};



// ============================================================
// HIERARCHICAL AUTO-LAYOUT ENGINE
// Reingold-Tilford simplified — no node overlap, tree-structured
// ============================================================
const NODE_W  = 90;   // card width
const NODE_H  = 80;   // card height (visual)
const H_GAP   = 36;   // min horizontal gap between node centres
const V_GAP   = 72;   // vertical distance between levels
const PAD_TOP = 58;   // space for zone label
const PAD_L   = 60;   // left padding per zone

const computeHierarchicalLayout = (zoneDevs) => {
  if (!zoneDevs.length) return {};

  const devMap = Object.fromEntries(zoneDevs.map(d => [d._id, d]));
  // Roots = no parent OR parent in different zone
  const roots = zoneDevs.filter(d => !d.parent_id || !devMap[d.parent_id]);
  const getChildren = id => zoneDevs.filter(d => d.parent_id === id);

  // Bottom-up: measure minimum subtree width
  const subtreeWidth = (id) => {
    const children = getChildren(id);
    if (!children.length) return NODE_W;
    const childTotal = children.reduce((s, c) => s + subtreeWidth(c._id), 0)
      + H_GAP * (children.length - 1);
    return Math.max(NODE_W, childTotal);
  };

  const result = {};

  // Top-down: assign centre positions
  const placeNode = (id, centreX, level) => {
    result[id] = { x: centreX, y: PAD_TOP + level * (NODE_H + V_GAP) };
    const children = getChildren(id);
    if (!children.length) return;
    const widths = children.map(c => subtreeWidth(c._id));
    const totalW = widths.reduce((a, b) => a + b, 0) + H_GAP * (children.length - 1);
    let curX = centreX - totalW / 2 + widths[0] / 2;
    children.forEach((child, i) => {
      placeNode(child._id, curX, level + 1);
      if (i < children.length - 1) curX += widths[i] / 2 + H_GAP + widths[i + 1] / 2;
    });
  };

  // Place roots horizontally side by side
  const rootWidths = roots.map(r => subtreeWidth(r._id));
  const totalRootW = rootWidths.reduce((a, b) => a + b, 0) + H_GAP * (roots.length - 1);
  let curX = PAD_L + rootWidths[0] / 2;
  // If only 1 root or few roots, centre them a bit
  if (roots.length === 1) curX = Math.max(PAD_L + NODE_W / 2, totalRootW / 2 + PAD_L);
  roots.forEach((root, i) => {
    placeNode(root._id, curX, 0);
    if (i < roots.length - 1) curX += rootWidths[i] / 2 + H_GAP + rootWidths[i + 1] / 2;
  });

  return result;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const HardwareSimulator = () => {
  const [customZones, setCustomZones] = useState([]);
  const [deletedZones, setDeletedZones] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sim_deleted_zones') || '[]'); }
    catch { return []; }
  });
  const [devices, setDevices]           = useState([]);
  
  const allZones = useMemo(() => {
    const zonesMap = new Map();
    DEFAULT_ZONES.forEach(z => {
      if (!deletedZones.includes(z.id)) zonesMap.set(z.id, z);
    });
    customZones.forEach(z => {
      if (!deletedZones.includes(z.id)) zonesMap.set(z.id, z);
    });
    
    // Auto detect from devices
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

  const handleAddZone = () => {
    const newZoneName = window.prompt('Nhập tên Phân vùng (Zone) mới (Ví dụ: Zone-D):');
    if (newZoneName && newZoneName.trim() !== '') {
      const zId = newZoneName.trim();
      if (!allZones.find(z => z.id === zId)) {
        setCustomZones(prev => [...prev, {
          id: zId,
          label: zId,
          subnet: Math.floor(Math.random() * 253 + 1).toString(),
          color: generateZoneColor(allZones.length),
          cssClass: 'zone-dynamic'
        }]);
      } else {
        toast.error('Phân vùng đã tồn tại!');
      }
    }
  };

  const handleDeleteZone = (zId, e) => {
    e.stopPropagation();
    const zoneDevs = devices.filter(d => (d.zone || 'Zone-A') === zId);
    if (zoneDevs.length > 0) {
      toast.error(`Không thể xóa phân vùng này vì đang chứa ${zoneDevs.length} thiết bị! Vui lòng xóa hoặc di chuyển thiết bị sang phân vùng khác trước.`);
      return;
    }
    if (window.confirm(`Xác nhận xóa phân vùng ${zId}?`)) {
      setCustomZones(prev => prev.filter(z => z.id !== zId));
      const newDeleted = [...deletedZones, zId];
      setDeletedZones(newDeleted);
      localStorage.setItem('sim_deleted_zones', JSON.stringify(newDeleted));
      toast.success(`Đã xóa phân vùng ${zId}.`);
    }
  };
  const [loading, setLoading]           = useState(true);
  const [logs, setLogs]                 = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [editForm, setEditForm]         = useState(null);
  const [savingEdit, setSavingEdit]     = useState(false);

  // Tree collapse state per zone
  const [zoneCollapsed, setZoneCollapsed] = useState({});
  // Per-node collapse in tree
  const [nodeCollapsed, setNodeCollapsed] = useState({});

  // Canvas positions (persisted)
  const [positions, setPositions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sim_positions_v2') || '{}'); }
    catch { return {}; }
  });

  const [dragNodeId, setDragNodeId]     = useState(null);
  const dragOffset                       = useRef({ x: 0, y: 0 });

  // Drop zone drag-over
  const [dragOverZone, setDragOverZone] = useState(null);
  // Template being dragged from toolbar
  const [dragTemplate, setDragTemplate] = useState(null);

  // Modal state
  const [modal, setModal] = useState(null); // { type: 'add' | 'delete', ... }

  // Zoom scale (0.3 – 1.5)
  const [canvasScale, setCanvasScale] = useState(1.0);

  const logsEndRef = useRef(null);

  // ---- Derived ----
  const deviceMap = useMemo(() => Object.fromEntries(devices.map(d => [d._id, d])), [devices]);
  const selectedDevice = selectedId ? deviceMap[selectedId] : null;

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

  // Devices by zone
  const byZone = useMemo(() => {
    const result = {};
    allZones.forEach(z => { result[z.id] = []; });
    devices.forEach(d => {
      const zone = d.zone || 'Zone-A';
      if (result[zone]) result[zone].push(d);
    });
    return result;
  }, [devices]);

  // Build tree: roots = no parent, then children
  const buildTree = useCallback((zoneId) => {
    const zoneDevs = byZone[zoneId] || [];
    const roots = zoneDevs.filter(d => !d.parent_id || !deviceMap[d.parent_id]);
    const renderNode = (node, depth = 0) => {
      const children = zoneDevs.filter(d => d.parent_id === node._id);
      return { node, depth, children: children.map(c => renderNode(c, depth + 1)) };
    };
    return roots.map(r => renderNode(r));
  }, [byZone, deviceMap]);

  // ---- API ----
  const fetchDevices = useCallback(async (isInit = false) => {
    try {
      if (isInit) setLoading(true);
      const res = await http.get('/devices/public/list', { params: { per_page: 1000 } });
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      // Filter out decommissioned devices (they are physically deleted)
      const connectedDevices = list.filter(d => d.status !== 'decommissioned');
      setDevices(connectedDevices);
    } catch (e) {
      addLog('error', '❌ Lỗi kết nối backend API.');
    } finally {
      if (isInit) setLoading(false);
    }
  }, []);

  const addLog = useCallback((type, message) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setLogs(prev => [...prev, { ts, type, message }].slice(-80));
  }, []);

  useEffect(() => {
    fetchDevices(true);
    addLog('system', '🔌 ICS-Guard Physical Simulator đã sẵn sàng.');
    addLog('system', '📡 Kết nối Mosquitto MQTT Broker :1883 | InfluxDB :8086 OK.');

    // Subscribe to WebSocket events for live updates
    socket.on('DEVICE_SYNC', () => {
      fetchDevices();
    });
    socket.on('DEVICE_STATUS_CHANGED', () => {
      fetchDevices();
    });

    return () => {
      socket.off('DEVICE_SYNC');
      socket.off('DEVICE_STATUS_CHANGED');
    };
  }, [fetchDevices]);

  // Telemetry simulation
  useEffect(() => {
    if (devices.length === 0) return;
    const timer = setInterval(() => {
      const active = devices.filter(d => d.status !== 'isolated' && d.status !== 'offline');
      if (!active.length) return;
      const d = active[Math.floor(Math.random() * active.length)];
      const t = d.node_type || d.type;
      let payload = '';
      if (t === 'sensor') payload = `temperature=${(Math.random() * 15 + 20).toFixed(1)}°C, humidity=${(Math.random() * 40 + 40).toFixed(0)}%`;
      else if (t === 'actuator') payload = `valve_position=${Math.floor(Math.random() * 100)}%, flow_rate=${(Math.random() * 5).toFixed(2)}L/s`;
      else if (t === 'controller') payload = `cpu_cycle=OB1, scan_time=${Math.floor(Math.random() * 8) + 2}ms, mem_ok=true`;
      else payload = `ping_rtt=1ms, pkts=64B, uptime=${Math.floor(Math.random() * 9999)}s`;
      addLog('telemetry', `📡 PUBLISH ics/telemetry/${d.zone}/${d._id?.slice(-6)} | ${payload}`);
    }, 3500);
    return () => clearInterval(timer);
  }, [devices]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const savePositions = useCallback((newPos) => {
    setPositions(newPos);
    localStorage.setItem('sim_positions_v2', JSON.stringify(newPos));
  }, []);

  // ---- Auto-layout on load: run hierarchical layout for any zone that has
  //      devices without a saved position (fresh add or first ever load) ----
  useEffect(() => {
    if (!devices.length) return;
    const currentPos = JSON.parse(localStorage.getItem('sim_positions_v2') || '{}');
    const merged = { ...currentPos };
    let changed = false;

    allZones.forEach(zone => {
      const zoneDevs = devices.filter(d => (d.zone || 'Zone-A') === zone.id);
      const unpositioned = zoneDevs.filter(d => !merged[d._id]);
      if (!unpositioned.length) return; // all already positioned

      // Re-run layout for the whole zone so tree is consistent
      const layout = computeHierarchicalLayout(zoneDevs);
      // Only save positions that are truly new
      Object.entries(layout).forEach(([id, pos]) => {
        if (!merged[id]) { merged[id] = pos; changed = true; }
      });
    });

    if (changed) savePositions(merged);
  }, [devices]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Reset layout: clear all positions and recompute ----
  const handleAutoLayout = useCallback(() => {
    const newPos = {};
    allZones.forEach(zone => {
      const zoneDevs = devices.filter(d => (d.zone || 'Zone-A') === zone.id);
      const layout = computeHierarchicalLayout(zoneDevs);
      Object.assign(newPos, layout);
    });
    savePositions(newPos);
    addLog('info', '⚙️ Đã tự động sắp xếp lại vị trí thiết bị trên canvas.');
  }, [devices, savePositions, addLog]);

  // ---- Wheel zoom ----
  const handleWheelZoom = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return; // only zoom when Ctrl held
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setCanvasScale(prev => Math.min(1.5, Math.max(0.25, parseFloat((prev + delta).toFixed(2)))));
  }, []);

  // ---- Compute canvas layout (reads saved hierarchical positions) ----
  const layoutForZone = useCallback((zoneId) => {
    const devs = byZone[zoneId] || [];
    return devs.map(d => ({
      ...d,
      cx: positions[d._id]?.x ?? (PAD_L + NODE_W / 2),
      cy: positions[d._id]?.y ?? PAD_TOP,
    }));
  }, [byZone, positions]);

  // ---- SVG cables ----
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

  // ---- Drag node on canvas (must account for canvasScale) ----
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
    // Convert screen coords → canvas-local coords (divide by scale)
    const x = Math.max(20, Math.min(
      (rect.width) / canvasScale - 20,
      (e.clientX - rect.left) / canvasScale
    ));
    const y = Math.max(44, Math.min(
      (rect.height) / canvasScale - 20,
      (e.clientY - rect.top) / canvasScale
    ));
    savePositions({ ...positions, [dragNodeId]: { x, y } });
  };

  const handleCanvasMouseUp = () => setDragNodeId(null);

  // ---- Template drag from toolbar ----
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

  // ---- Open modals ----
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

  const openAddChildModal = (parentNode) => {
    // Determine valid child types based on parent
    const defaultChildType = parentNode.node_type === 'gateway' ? 'controller' : 'sensor';
    openAddModal(defaultChildType, parentNode.zone || 'Zone-A');
    setModal(prev => prev ? { ...prev, form: { ...prev.form, parent_id: parentNode._id } } : prev);
  };

  const openDeleteModal = (node) => {
    const children = devices.filter(d => d.parent_id === node._id);
    setModal({ type: 'delete', node, children });
  };

  // ---- Submit add device ----
  const handleAddDevice = async () => {
    const { form, dropPos } = modal;
    if (!form.name.trim()) { toast.error('Vui lòng điền tên thiết bị.'); return; }

    // Validation rules
    const meta = TYPE_META[form.node_type];
    if (meta?.needsParent && !form.parent_id) {
      toast.error(`Thiết bị loại "${meta.label}" cần chọn một Parent (Gateway/Controller).`);
      return;
    }

    if (form.parent_id) {
      const parent = deviceMap[form.parent_id];
      if (parent && !canParent(parent.node_type || parent.type, form.node_type)) {
        toast.error(`Loại thiết bị "${meta?.label}" không thể là con của "${parent.name}" (${parent.node_type}).`);
        return;
      }
    }

    try {
      const res = await http.post('/devices/public/simulator-crud', {
        action: 'create',
        // Backend now handles setting status to unprovisioned
        device: { ...form }
      });
      if (res?.device) {
        const newId = res.device._id;
        if (dropPos) savePositions({ ...positions, [newId]: dropPos });
        toast.success(`Cắm nóng "${form.name}" thành công! Đang chờ duyệt.`);
        addLog('success', `🟢 PLUG [${form.node_type.toUpperCase()}] "${form.name}" @ ${form.ipAddress} → Zone ${form.zone} (Chờ duyệt)`);
        setModal(null);
        fetchDevices();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi thêm thiết bị.');
    }
  };

  // ---- Submit delete ----
  const handleDeleteDevice = async () => {
    const { node } = modal;
    try {
      await http.post('/devices/public/simulator-crud', { action: 'delete', id: node._id });
      toast.success(`Đã rút dây mạng "${node.name}". Thiết bị đã chuyển sang trạng thái Offline.`);
      addLog('unplug', `🔴 UNPLUG "${node.name}" (${node.ipAddress || node.ip_address}) — Chuyển sang Offline.`);
      setModal(null);
      fetchDevices();
    } catch (err) {
      toast.error('Lỗi ngắt kết nối thiết bị.');
    }
  };

  const handleReconnectDevice = async (node) => {
    try {
      await http.post('/devices/public/simulator-crud', { action: 'reconnect', id: node._id });
      toast.success(`Đã cắm lại dây mạng cho "${node.name}". Thiết bị đang online.`);
      addLog('success', `🟢 RECONNECT "${node.name}" (${node.ipAddress || node.ip_address || ''}) — Chuyển sang Online.`);
      fetchDevices();
    } catch (err) {
      toast.error('Lỗi khi kết nối lại thiết bị.');
    }
  };

  // ---- Save edit config ----
  const handleSaveEdit = async () => {
    if (!editForm || !selectedDevice) return;
    setSavingEdit(true);
    try {
      await http.post('/devices/public/simulator-crud', {
        action: 'update',
        id: selectedDevice._id,
        device: {
          name: editForm.name,
          hardware_model: editForm.hardware_model,
          firmware_version: editForm.firmware_version,
        }
      });
      toast.success('Cập nhật cấu hình thành công.');
      addLog('info', `⚙️ CONFIG UPDATE "${editForm.name}" — hw: ${editForm.hardware_model}, fw: ${editForm.firmware_version}`);
      fetchDevices();
    } catch (err) {
      toast.error('Lỗi cập nhật cấu hình.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Sync editForm when selectedDevice changes
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

  // ---- Regenerate network config in modal ----
  const handleRegenNet = () => {
    if (!modal?.form) return;
    setModal(prev => ({
      ...prev,
      form: {
        ...prev.form,
        ipAddress: generateIp(prev.form.zone, existingIps),
        macAddress: generateMac(),
      }
    }));
  };

  // ---- Tree rendering (recursive) ----
  const renderTreeNode = ({ node, depth, children }) => {
    const meta = TYPE_META[node.node_type || node.type] || {};
    const isSelected = selectedId === node._id;
    const isCollapsed = nodeCollapsed[node._id];
    const hasChildren = children.length > 0;

    const reachable = isDeviceReachable(node._id);
    const isOffline = node.status === 'offline';
    const isUnreachable = !reachable && !isOffline;

    return (
      <div key={node._id} className="tree-node" style={{ '--depth-left': `${14 + depth * 14}px` }}>
        {depth > 0 && <div className="tree-connector" />}
        <div
          className={`tree-node-row${isSelected ? ' selected' : ''}`}
          style={{ 
            paddingLeft: `${14 + depth * 14}px`,
            opacity: isOffline ? 0.4 : isUnreachable ? 0.6 : 1.0
          }}
          onClick={() => setSelectedId(node._id)}
        >
          {hasChildren ? (
            <button
              className={`tree-expand-btn${isCollapsed ? '' : ' expanded'}`}
              onClick={e => { e.stopPropagation(); setNodeCollapsed(p => ({ ...p, [node._id]: !p[node._id] })); }}
            >
              <ChevronRight size={11} />
            </button>
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
          )}

          <div
            className="tree-node-icon"
            style={{ background: `${meta.color}18`, color: meta.color }}
          >
            {getIcon(node.icon_path || meta.icon, 'sm')}
          </div>

          <div className="tree-node-info">
            <div className="tree-node-name">{node.name}</div>
            <div className="tree-node-ip">{node.ipAddress || node.ip_address || ''}</div>
          </div>

          <div className={`tree-node-status-dot ${isOffline ? 'offline' : isUnreachable ? 'unreachable' : (node.status || 'active')}`} />

          <div className="tree-node-actions">
            {meta.canBeParent && (
              <button
                className="btn-add-child"
                title="Thêm thiết bị con"
                onClick={e => { e.stopPropagation(); openAddChildModal(node); }}
              >
                <Plus size={11} />
              </button>
            )}
            <button
              className="btn-remove"
              title="Xóa thiết bị"
              onClick={e => { e.stopPropagation(); openDeleteModal(node); }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {!isCollapsed && hasChildren && (
          <div>
            {children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  // ---- Canvas node rendering ----
  const renderCanvasNode = (node) => {
    const meta = TYPE_META[node.node_type || node.type] || {};
    const isSelected = selectedId === node._id;
    const status = node.status || 'active';

    const reachable = isDeviceReachable(node._id);
    const isOffline = status === 'offline';
    const isUnreachable = !reachable && !isOffline;

    return (
      <div
        key={node._id}
        className={`canvas-node status-${status}${isUnreachable ? ' unreachable' : ''}${isSelected ? ' selected' : ''}`}
        style={{ left: node.cx, top: node.cy }}
        onClick={() => setSelectedId(node._id)}
        onMouseDown={e => handleNodeMouseDown(e, node)}
        title={`${node.name}\n${node.ipAddress || ''}${isUnreachable ? ' (Mất kết nối trung gian)' : ''}`}
      >
        {status === 'quarantined' && <div className="attack-pulse" />}
        <div 
          className="canvas-node-body"
          style={isUnreachable ? { opacity: 0.6, filter: 'grayscale(100%)' } : {}}
        >
          <div className="node-status-ring" style={{ borderColor: '#111827' }} />
          <div
            className="node-icon-wrap"
            style={{
              background: `${meta.color}18`,
              border: `1px solid ${meta.color}40`,
              color: meta.color
            }}
          >
            {getIcon(node.icon_path || meta.icon)}
            <span
              className="node-status-ring"
              style={{ background: isOffline ? '#6b7280' : isUnreachable ? '#94a3b8' : status === 'active' ? '#10b981' : status === 'isolated' ? '#f59e0b' : '#ef4444' }}
            />
          </div>
          <div className="node-name">{node.name}</div>
          <div className="node-ip-badge">{(node.ipAddress || node.ip_address || '').split('.').slice(-2).join('.')}</div>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="sim-root">
        <div className="sim-loading">
          <div className="loading-spinner" />
          <span>Đang quét mạng ICS subnet...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sim-root">

      {/* ===== HEADER ===== */}
      <header className="sim-header">
        <div className="sim-header-brand">
          <div className="brand-icon"><Server size={20} /></div>
          <h1>ICS-Guard Physical Network Simulator</h1>
          <span className="mode-pill">Physical Sim</span>
        </div>
        <div className="sim-header-status">
          <span><span className="status-dot online" />MQTT :1883 OK</span>
          <span>
            Nodes: <span className="node-count">{devices.length}</span>
          </span>
          <button className="icon-btn" onClick={() => fetchDevices()} title="Làm mới">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* ===== BODY: 3 panels ===== */}
      <div className="sim-body">

        {/* LEFT: IoT Tree */}
        <aside className="sim-tree-panel">
          <div className="tree-panel-header">
            <h2>IoT Device Tree</h2>
            <button className="btn-add-root" onClick={() => openAddModal('gateway')}>
              <Plus size={11} /> Gateway
            </button>
          </div>
          <div className="tree-scroll">
            {allZones.map(zone => {
              const tree = buildTree(zone.id);
              const collapsed = zoneCollapsed[zone.id];
              return (
                <div key={zone.id} className="tree-zone-group">
                  <div
                    className="tree-zone-label"
                    onClick={() => setZoneCollapsed(p => ({ ...p, [zone.id]: !p[zone.id] }))}
                  >
                    <ChevronRight
                      size={11}
                      className={`zone-chevron${collapsed ? '' : ' open'}`}
                    />
                    <span style={{ color: zone.color }}>{zone.id}</span>
                    <span style={{ color: '#64748b', fontWeight: 400 }}>
                      ({byZone[zone.id]?.length || 0})
                    </span>
                  </div>
                  {!collapsed && (
                    tree.length === 0 ? (
                      <div style={{ padding: '4px 20px 8px', fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
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
          {/* Toolbar: grouped device chips + zoom controls */}
          <div className="sim-canvas-toolbar">
            <span className="toolbar-label">Kéo thả:</span>
            <div className="toolbar-chips-scroll">
              {Object.entries(DEVICE_GROUPS).map(([groupName, types], gi) => (
                <div key={groupName} className="toolbar-group">
                  {gi > 0 && <div className="toolbar-divider" />}
                  <span className="toolbar-group-label">{groupName}</span>
                  {types.map(tpl => (
                    <div
                      key={tpl.type}
                      className="template-chip"
                      style={{ '--chip-color': tpl.color }}
                      draggable
                      onDragStart={() => handleTemplateDragStart(tpl)}
                      title={`${tpl.label}\n${tpl.hw}\nKéo thả vào zone để thêm`}
                    >
                      <span style={{ color: tpl.color }}>{getIcon(tpl.icon, 'sm')}</span>
                      <span className="chip-label">{tpl.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Zoom controls */}
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
          </div>

          <div
            className="sim-canvas-scroll"
            onMouseUp={handleCanvasMouseUp}
            onWheel={handleWheelZoom}
            style={{ cursor: dragNodeId ? 'grabbing' : 'default' }}
          >
            <div
              className="sim-canvas"
              style={{
                transform: `scale(${canvasScale})`,
                transformOrigin: 'top left',
                width: `${100 / canvasScale}%`,
                minHeight: `${100 / canvasScale}%`,
              }}
            >
              {allZones.map(zone => {
                const laid = layoutForZone(zone.id);
                const cables = cablesForZone(zone.id, laid);
                const maxCy = laid.length ? Math.max(...laid.map(n => n.cy)) : 0;
                const zoneHeight = Math.max(180, maxCy + NODE_H + 40);

                return (
                  <div
                    key={zone.id}
                    className={`zone-row ${zone.cssClass}${dragOverZone === zone.id ? ' drag-over' : ''}`}
                    style={{ height: zoneHeight }}
                    onDragOver={e => handleZoneDragOver(e, zone.id)}
                    onDragLeave={handleZoneDragLeave}
                    onDrop={e => handleZoneDrop(e, zone.id)}
                    onMouseMove={e => handleCanvasMouseMove(e, e.currentTarget)}
                  >
                    <div className="zone-label" style={{ color: zone.color, background: `${zone.color}14` }}>
                      <Layers size={11} />
                      {zone.label}
                      <button 
                        onClick={(e) => handleDeleteZone(zone.id, e)} 
                        title="Xóa phân vùng"
                        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, padding: '0 4px', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>

                    {/* SVG cables */}
                    <svg className="zone-svg" style={{ width: '100%', height: '100%' }}>
                      <defs>
                        <marker id={`arrow-${zone.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                          <path d="M0,0 L6,3 L0,6 Z" fill="#334155" />
                        </marker>
                      </defs>
                      {cables.map(c => {
                        const parentDev = deviceMap[c.id.split('-')[0]];
                        const childDev = deviceMap[c.id.split('-')[1]];
                        const isParentReachable = parentDev ? isDeviceReachable(parentDev._id) : true;
                        const isChildReachable = childDev ? isDeviceReachable(childDev._id) : true;
                        const isLinkOffline = (parentDev && parentDev.status === 'offline') || 
                                              (childDev && childDev.status === 'offline') ||
                                              !isParentReachable || !isChildReachable;
                        const isQ = c.status === 'quarantined' || c.parentStatus === 'quarantined';
                        const isI = c.status === 'isolated' || c.parentStatus === 'isolated';
                        return (
                          <line
                            key={c.id}
                            x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                            stroke={isLinkOffline ? '#475569' : isQ ? '#ef4444' : isI ? '#f59e0b' : '#334155'}
                            strokeWidth={isQ ? 2.5 : 1.5}
                            strokeDasharray={isLinkOffline ? '4,4' : isI ? '5,4' : 'none'}
                            markerEnd={`url(#arrow-${zone.id})`}
                            opacity={isLinkOffline ? 0.4 : 0.8}
                          />
                        );
                      })}
                    </svg>

                    {/* Nodes */}
                    {laid.map(node => renderCanvasNode(node))}

                    {laid.length === 0 && (
                      <div className="zone-empty">
                        Thả thiết bị vào {zone.id}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Thêm phân vùng động */}
              <div 
                className="zone-row add-zone-row" 
                onClick={handleAddZone}
                style={{ 
                  height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', cursor: 'pointer', 
                  opacity: 0.6, background: 'rgba(255,255,255,0.02)', borderRadius: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', color: '#94a3b8' }}>
                  <Plus size={20} />
                  <span>[+ Thêm Phân vùng mới]</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT: Config Panel */}
        <aside className="sim-config-panel">
          <div className="config-panel-header">
            <h2>Device Config</h2>
            {selectedDevice && (
              <button className="btn-close-config" onClick={() => setSelectedId(null)}>
                <X size={14} />
              </button>
            )}
          </div>

          {!selectedDevice ? (
            <div className="config-empty">
              <Info size={32} />
              <span>Chọn một thiết bị trên canvas hoặc cây IoT Tree để xem chi tiết</span>
            </div>
          ) : (
            <div className="config-scroll">
              {/* Header */}
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

              {/* Read-only fields */}
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
                     selectedDevice.status === 'isolated' ? 'Isolated' :
                     selectedDevice.status === 'unprovisioned' ? 'Unprovisioned' : 'Alert'}
                  </span>
                </div>
                {selectedDevice.parent_id && (
                  <div className="config-field">
                    <label>Parent</label>
                    <div className="field-value">{deviceMap[selectedDevice.parent_id]?.name || selectedDevice.parent_id}</div>
                  </div>
                )}
              </div>

              {/* Editable fields */}
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

              {/* Actions */}
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
          )}
        </aside>
      </div>

      {/* ===== TERMINAL LOG ===== */}
      <div className="sim-terminal">
        <div className="terminal-bar">
          <div className="dots">
            <span /><span /><span />
          </div>
          <span className="terminal-title-text">physical_telemetry_loop.log</span>
          <button className="btn-clear-log" onClick={() => setLogs([])}>clear</button>
        </div>
        <div className="terminal-body">
          {logs.map((log, i) => (
            <div key={i} className={`log-line type-${log.type}`}>
              <span className="log-ts">[{log.ts}]</span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))}
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
              {/* Tên */}
              <div className="modal-field">
                <label>Tên thiết bị *</label>
                <input
                  placeholder="VD: PLC Nhánh B, Cảm biến nhiệt độ 3..."
                  value={modal.form.name}
                  onChange={e => setModal(p => ({ ...p, form: { ...p.form, name: e.target.value } }))}
                  autoFocus
                />
              </div>

              {/* Loại thiết bị */}
              <div className="modal-field">
                <label>Loại thiết bị *</label>
                <select
                  value={modal.form.node_type}
                  onChange={e => {
                    const t = e.target.value;
                    const meta = TYPE_META[t] || {};
                    setModal(p => ({
                      ...p,
                      form: { ...p.form, node_type: t, icon_path: meta.icon, hardware_model: meta.hw, firmware_version: meta.fw }
                    }));
                  }}
                >
                  {DEVICE_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
              </div>

              {/* Zone */}
              <div className="modal-field">
                <label>Zone *</label>
                <select
                  value={modal.form.zone}
                  onChange={e => {
                    const zone = e.target.value;
                    const ip = generateIp(zone, existingIps);
                    setModal(p => ({ ...p, form: { ...p.form, zone, ipAddress: ip } }));
                  }}
                >
                  {allZones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                </select>
              </div>

              {/* Parent */}
              <div className="modal-field">
                <label>Parent (Gateway / Controller)</label>
                <select
                  value={modal.form.parent_id}
                  onChange={e => setModal(p => ({ ...p, form: { ...p.form, parent_id: e.target.value } }))}
                >
                  <option value="">— Không có (Root) —</option>
                  {devices
                    .filter(d => canParent(d.node_type || d.type, modal.form.node_type) && d.zone === modal.form.zone)
                    .map(d => (
                      <option key={d._id} value={d._id}>
                        [{d.zone}] {d.name} ({d.ipAddress || d.ip_address})
                      </option>
                    ))}
                </select>
                {TYPE_META[modal.form.node_type]?.needsParent && !modal.form.parent_id && (
                  <div className="modal-field-warning">
                    <AlertTriangle size={12} /> Loại thiết bị này nên có parent để đảm bảo tính đúng đắn.
                  </div>
                )}
              </div>

              {/* Hardware */}
              <div className="modal-field">
                <label>Hardware Model</label>
                <input
                  value={modal.form.hardware_model}
                  onChange={e => setModal(p => ({ ...p, form: { ...p.form, hardware_model: e.target.value } }))}
                />
              </div>

              {/* IP + MAC */}
              <div className="modal-field">
                <label>IP / MAC (Auto-generated)</label>
                <div className="modal-field-row">
                  <input value={modal.form.ipAddress} disabled />
                  <button onClick={handleRegenNet} type="button">↻ Sinh lại</button>
                </div>
                <div className="modal-field-hint">MAC: {modal.form.macAddress}</div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn-cancel-modal" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn-submit-modal" onClick={handleAddDevice}>
                <Plus size={15} /> Cắm kết nối
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'delete' && (
        <div className="sim-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="confirm-modal">
            <h3>Ngắt kết nối thiết bị?</h3>
            <p>Xác nhận ngắt kết nối vật lý thiết bị:</p>
            <p><strong style={{ color: '#f1f5f9' }}>{modal.node.name}</strong></p>
            <p style={{ fontSize: 12 }}>{modal.node.ipAddress || modal.node.ip_address}</p>

            {modal.children?.length > 0 && (
              <div className="cascade-warning">
                <AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Cảnh báo: {modal.children.length} thiết bị con sẽ mất kết nối cha:
                {modal.children.map(c => (
                  <div key={c._id} style={{ marginLeft: 12, marginTop: 3 }}>• {c.name}</div>
                ))}
              </div>
            )}

            <div className="confirm-actions">
              <button className="btn-confirm-cancel" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn-confirm-delete" onClick={handleDeleteDevice}>
                <Trash2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Xác nhận ngắt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HardwareSimulator;
