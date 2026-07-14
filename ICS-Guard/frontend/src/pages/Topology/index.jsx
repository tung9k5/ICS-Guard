import React, { useState, useEffect, useMemo } from 'react';
import http from '@/http/clients/api';
import socket from '@/services/socket';
import ApiDevice from '@/api/device';
import DeviceForm from '../Assets/DeviceForm';
import { 
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, 
  ToggleLeft, ToggleRight, Volume2, Fan, Activity, ShieldAlert, 
  ShieldCheck, Lock, Unlock, HelpCircle, RefreshCw, Edit, ArrowRightLeft,
  ChevronRight, ChevronDown, Database, Monitor, Share2, Server, Trash2
} from 'lucide-react';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import './Topology.scss';

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

const Topology = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  
  // Edit Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  const fetchDevices = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await http.get('/devices/public/list-all');
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
      const cached = sessionStorage.getItem('cached_user');
      return cached ? JSON.parse(cached)?.role : null;
    } catch (e) {
      return null;
    }
  }, []);

  const canManage = currentUserRole === 'admin' || currentUserRole === 'device_manager';

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
      if (selectedNodeId === node._id) setSelectedNodeId(null);
      fetchDevices();
    } catch (err) {
      toast.error('Xóa thiết bị thất bại.');
    }
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
            {node.status}
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

  return (
    <div className="topology-page">
      <div className="topology-header">
        <div className="title-section">
          <h1>Sơ đồ & Cấu hình Thiết bị IoT (Topology)</h1>
          <p>Trực quan hóa cấu trúc mạng ICS/SCADA dạng phân cấp và hệ thống phòng thủ chủ động SOC.</p>
        </div>
        <button className="refresh-btn" onClick={() => fetchDevices(false)} title="Làm mới sơ đồ">
          <RefreshCw size={16} />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="topology-workbench">
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

        {/* Right Pane: Active Defense Panel */}
        <div className="topology-detail-panel">
          <h2>Bảng Điều khiển An ninh (Active Defense)</h2>
          
          {activeNode ? (
            <div className={`detail-card status-${activeNode.status}`}>
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
                  <span className="value" style={{ textTransform: 'uppercase' }}>{activeNode.node_type || activeNode.nodeType}</span>
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
              </div>

              {/* Software Action Control (Visible if selected & user has permissions) */}
              {canManage && (
                <div className="card-actions-layout">
                  {activeNode.status === 'unprovisioned' && (
                    <button className="action-btn restore-btn" style={{ background: '#10b981', color: 'white' }} onClick={() => handleApprove(activeNode)}>
                      <CheckCircle size={16} /> Duyệt thiết bị (Approve)
                    </button>
                  )}

                  {activeNode.status === 'active' && (
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

                  {activeNode.status === 'offline' && (
                    <button className="action-btn isolate-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }} onClick={() => handleDelete(activeNode)}>
                      <Trash2 size={16} /> Xóa thiết bị khỏi hệ thống
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-detail-state">
              <HelpCircle size={48} className="help-icon" />
              <p>Chọn một thiết bị trên sơ đồ để hiển thị thông số chi tiết và thực hiện cấu hình phần mềm hoặc cách ly an ninh mạng.</p>
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

export default Topology;
