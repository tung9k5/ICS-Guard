import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Server, Shield, Activity, TriangleAlert, Cpu, Database, 
  Network, CheckCircle, Trash2, ChevronRight, ChevronDown, Monitor, Share2 
} from 'lucide-react';
import http from '@/http/clients/api';
import VHeaderPage from '@/components/VHeaderPage';
import { toast } from '@/utils/toast';
import './AssetManagement.scss';

// Map icon paths from simulator to Lucide icons
const getIconForType = (type, path) => {
  const iconMap = {
    Network: <Network size={16} />,
    Cpu: <Cpu size={16} />,
    Server: <Server size={16} />,
    Database: <Database size={16} />,
    Monitor: <Monitor size={16} />,
    Shield: <Shield size={16} />,
    Share2: <Share2 size={16} />
  };
  return iconMap[path] || <Cpu size={16} />;
};

const Assets = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await http.get('/devices/public/list-all');
      let data = Array.isArray(res) ? res : (res?.data || []);
      setDevices(data);
    } catch (err) {
      console.error('Error fetching read-only devices:', err);
      toast.error('Lỗi khi tải danh sách thiết bị.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleProvision = async (id) => {
    try {
      await http.post(`/devices/${id}/provision`);
      toast.success(`Duyệt thiết bị ${id} thành công!`);
      fetchDevices();
    } catch (e) {
      toast.error('Lỗi khi duyệt thiết bị.');
    }
  };

  const handleDecommission = async (id) => {
    if (!window.confirm(`Bạn có chắc chắn muốn Hủy cấp phép thiết bị ${id}?`)) return;
    try {
      await http.delete(`/devices/${id}/decommission`);
      toast.success(`Hủy cấp phép thiết bị ${id} thành công!`);
      fetchDevices();
    } catch (e) {
      toast.error('Lỗi khi hủy cấp phép thiết bị.');
    }
  };

  const toggleExpand = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // KPI Metrics calculation
  const metrics = useMemo(() => {
    return {
      total: devices.length,
      active: devices.filter(d => d.status === 'active').length,
      unprovisioned: devices.filter(d => d.status === 'unprovisioned').length,
      offline: devices.filter(d => d.status === 'offline').length,
      alerts: devices.filter(d => d.status === 'quarantined' || d.status === 'isolated').length
    };
  }, [devices]);

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

    return roots;
  }, [devices]);

  // Recursive render for TreeTable rows
  const renderRow = (node, depth = 0) => {
    const id = node._id || node.id;
    const isExpanded = !!expandedNodes[id];
    const hasChildren = node.children && node.children.length > 0;

    const rows = [
      <tr key={id}>
        <td>
          <div className="col-name">
            {Array.from({ length: depth }).map((_, i) => (
              <span key={i} className="indent-spacer" />
            ))}
            
            <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
              {hasChildren && (
                <button className="expand-btn" onClick={() => toggleExpand(id)}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
            </div>

            <div className="device-icon">
              {getIconForType(node.node_type, node.icon_path)}
            </div>
            <div>
              <div className="device-name">{node.name}</div>
              <div className="device-id">{id}</div>
            </div>
          </div>
        </td>
        <td>
          <span className="col-type">{node.node_type || node.type}</span>
          {node.zone && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{node.zone}</div>}
        </td>
        <td className="col-net">
          <div>IP: {node.ipAddress || node.ip_address || '-'}</div>
          <div style={{ fontSize: 11 }}>MAC: {node.macAddress || node.mac_address || '-'}</div>
        </td>
        <td>
          <span className={`status-badge status-${node.status}`}>
            {node.status}
          </span>
        </td>
        <td>
          <div className="col-actions">
            {node.status === 'unprovisioned' && (
              <button className="btn-action btn-provision" onClick={() => handleProvision(id)} title="Duyệt / Cấp phép">
                <CheckCircle size={14} /> Duyệt
              </button>
            )}
            {node.status === 'offline' && (
              <button className="btn-action btn-decommission" onClick={() => handleDecommission(id)} title="Hủy cấp phép vĩnh viễn">
                <Trash2 size={14} /> Hủy
              </button>
            )}
          </div>
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
    <div className="assets-premium-page">
      <VHeaderPage title="Quản trị Tài sản & Topology (Asset Management)" />

      {/* KPI Dashboard */}
      <div className="kpi-dashboard" style={{ marginTop: 24 }}>
        <div className="kpi-card">
          <div className="icon-box blue"><Server size={24} /></div>
          <div className="kpi-info">
            <h4>Tổng thiết bị</h4>
            <div className="value">{metrics.total}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="icon-box green"><Activity size={24} /></div>
          <div className="kpi-info">
            <h4>Đang hoạt động (Active)</h4>
            <div className="value">{metrics.active}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="icon-box purple"><Shield size={24} /></div>
          <div className="kpi-info">
            <h4>Chờ duyệt (Unprovisioned)</h4>
            <div className="value">{metrics.unprovisioned}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="icon-box red"><TriangleAlert size={24} /></div>
          <div className="kpi-info">
            <h4>Cảnh báo / Mất kết nối</h4>
            <div className="value">{metrics.alerts + metrics.offline}</div>
          </div>
        </div>
      </div>

      {/* TreeTable Data Grid */}
      <div className="treetable-container">
        <div className="table-toolbar">
          <h3><Network size={18} color="#60a5fa" /> Cấu trúc liên kết mạng (Network Topology)</h3>
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải cấu trúc mạng...</div>
        ) : (
          <table className="treetable">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Tài sản (Tên / Node ID)</th>
                <th style={{ width: '15%' }}>Loại / Phân vùng</th>
                <th style={{ width: '20%' }}>Network (IP/MAC)</th>
                <th style={{ width: '15%' }}>Trạng thái</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {treeData.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    Chưa có thiết bị nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                treeData.map(root => renderRow(root, 0))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Assets;
