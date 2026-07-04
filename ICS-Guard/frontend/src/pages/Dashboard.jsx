import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import http from '@/http/clients/api';
import { 
  Activity, ShieldAlert, Zap, RefreshCw, Cpu, LogOut, 
  ChevronDown, ChevronRight, ShieldCheck, Radio, Thermometer, Droplets, Wind, Gauge
} from 'lucide-react';
import authApi from '@/api/auth';
import './Dashboard.scss';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ devices: 0, alerts: 0, incidents: 0 });
  const [loading, setLoading] = useState(true);

  const getUserRole = () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return 'viewer';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || 'viewer';
    } catch (e) {
      return 'viewer';
    }
  };

  const userRole = getUserRole();
  const canRespond = userRole === 'admin' || userRole === 'l3_manager';
  const canRollback = userRole === 'admin' || userRole === 'l3_manager' || userRole === 'ot_operator';
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [collapsedZones, setCollapsedZones] = useState({ 'Zone-B': true, 'Zone-C': true });
  const selectedDeviceIdRef = useRef(null);

  const toggleZone = (zoneName) => {
    setCollapsedZones(prev => ({
      ...prev,
      [zoneName]: !prev[zoneName]
    }));
  };

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'Network': return <Activity size={16} />;
      case 'Cpu': return <Cpu size={16} />;
      case 'Radio': return <Radio size={16} />;
      case 'Thermometer': return <Thermometer size={16} />;
      case 'Droplets': return <Droplets size={16} />;
      case 'Zap': return <Zap size={16} />;
      case 'Wind': return <Wind size={16} />;
      case 'Gauge': return <Gauge size={16} />;
      default: return <Cpu size={16} />;
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authApi.logout({ refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    }
  };

  // Fetch metrics and incident list
  const fetchDashboardData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      // Fetch devices and incidents in parallel
      const [devicesRes, incidentsRes] = await Promise.all([
        http.get('/devices'),
        http.get('/incidents')
      ]);

      const deviceList = Array.isArray(devicesRes) ? devicesRes : [];
      setDevices(deviceList);

      const deviceCount = deviceList.length;
      const incidentList = Array.isArray(incidentsRes) ? incidentsRes : [];
      
      // Calculate alert count (summing up alert IDs linked to incidents)
      let alertCount = 0;
      incidentList.forEach(inc => {
        if (inc.alert_ids) alertCount += inc.alert_ids.length;
      });

      setStats({
        devices: deviceCount,
        alerts: alertCount || incidentList.length * 2, // fallback approximation
        incidents: incidentList.length
      });

      // Keep active selection in sync
      const currentSelectedId = selectedDeviceIdRef.current;
      if (currentSelectedId) {
        const freshDevice = deviceList.find(d => d._id === currentSelectedId);
        if (freshDevice) {
          setSelectedDevice(freshDevice);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handleIsolateDevice = async (id) => {
    try {
      await http.post(`/devices/${id}/isolate`);
      await fetchDashboardData(false);
    } catch (error) {
      console.error('Isolate device error:', error);
      const errMsg = error.response?.data?.message || 'Không thể cô lập thiết bị. Vui lòng kiểm tra quyền hạn của bạn.';
      alert(errMsg);
    }
  };

  const handleUnisolateDevice = async (id) => {
    try {
      await http.post(`/devices/${id}/unisolate`);
      await fetchDashboardData(false);
    } catch (error) {
      console.error('Unisolate device error:', error);
      const errMsg = error.response?.data?.message || 'Không thể mở khóa thiết bị. Vui lòng kiểm tra quyền hạn của bạn.';
      alert(errMsg);
    }
  };

  const handleRollbackDevice = async (id) => {
    try {
      await http.post(`/devices/${id}/rollback`);
      await fetchDashboardData(false);
      alert('Đã gửi lệnh nạp lại logic Safe-Mode cho PLC thành công.');
    } catch (error) {
      console.error('Rollback logic error:', error);
      const errMsg = error.response?.data?.message || 'Không thể rollback logic. Vui lòng kiểm tra quyền hạn của bạn.';
      alert(errMsg);
    }
  };

  const handleIsolateAllQuarantined = async () => {
    const targets = devices.filter(d => d.status === 'quarantined');
    if (targets.length === 0) return;

    if (window.confirm(`Bạn có chắc chắn muốn kích hoạt cô lập khẩn cấp đồng loạt ${targets.length} thiết bị đang bị tấn công?`)) {
      try {
        await Promise.all(targets.map(device => http.post(`/devices/${device._id}/isolate`)));
        await fetchDashboardData(false);
      } catch (error) {
        console.error('Batch isolation error:', error);
        alert('Cô lập đồng loạt thất bại. Vui lòng thử lại.');
      }
    }
  };

  const handleSelectDevice = async (device) => {
    setSelectedDevice(device);
    selectedDeviceIdRef.current = device._id;
    await fetchDashboardData(false);
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchDashboardData(true);
  }, []);

  // Auto refresh stats silently every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchDashboardData(false), 2000);
    return () => clearInterval(interval);
  }, []);

  // Recursively render device tree
  const renderTreeNode = (device, level = 0) => {
    const children = devices.filter(d => d.parent_id === device._id);
    const hasChildren = children.length > 0;
    const isSelected = selectedDevice?._id === device._id;

    return (
      <div key={device._id} className="tree-node-wrapper" style={{ marginLeft: `${level * 15}px`, marginTop: '4px' }}>
        <div 
          className={`tree-node-item ${isSelected ? 'selected' : ''}`}
          onClick={() => handleSelectDevice(device)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: isSelected ? 'rgba(57, 255, 20, 0.08)' : 'rgba(255, 255, 255, 0.01)',
            border: `1px solid ${isSelected ? 'rgba(57, 255, 20, 0.25)' : 'rgba(255, 255, 255, 0.04)'}`,
            borderRadius: '0.35rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div className="node-icon" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.25rem',
            borderRadius: '0.25rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: device.status === 'quarantined' ? '#ff003c' : device.status === 'isolated' ? '#ffaa00' : '#39ff14'
          }}>
            {getIcon(device.icon_path)}
          </div>

          <div className="node-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
            <span className="node-name" style={{ fontWeight: 500, color: '#e6edf3', fontSize: '0.88rem' }}>{device.name}</span>
            <span className="node-id" style={{ color: '#8b949e', fontSize: '0.75rem' }}>({device._id})</span>
            
            <span className={`node-badge-type node-type-${device.node_type}`} style={{
              fontSize: '0.68rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#8b949e'
            }}>
              {device.node_type}
            </span>

            {/* Status badge next to type */}
            <span className={`node-badge-status status-${device.status}`} style={{
              fontSize: '0.68rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: device.status === 'quarantined' ? 'rgba(255, 0, 60, 0.15)' : device.status === 'isolated' ? 'rgba(255, 170, 0, 0.15)' : 'rgba(57, 255, 20, 0.15)',
              color: device.status === 'quarantined' ? '#ff003c' : device.status === 'isolated' ? '#ffaa00' : '#39ff14',
              borderColor: device.status === 'quarantined' ? 'rgba(255, 0, 60, 0.3)' : device.status === 'isolated' ? 'rgba(255, 170, 0, 0.3)' : 'rgba(57, 255, 20, 0.3)'
            }}>
              {device.status === 'active' ? 'Bình thường' : device.status === 'quarantined' ? 'Bị Tấn Công' : device.status === 'isolated' ? 'Đang Cô Lập' : device.status}
            </span>
          </div>
        </div>

        {hasChildren && (
          <div className="node-children" style={{
            marginTop: '0.5rem',
            borderLeft: '1px dashed rgba(255, 255, 255, 0.08)',
            paddingLeft: '0.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            {children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1>ICS-Guard Operations Center (SOC)</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontSize: '13px', color: '#8b949e', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>Tài khoản: {localStorage.getItem('access_token') ? JSON.parse(atob(localStorage.getItem('access_token').split('.')[1])).username : 'Khách'}</span>
            <span style={{ fontSize: '11px', color: '#39ff14', textTransform: 'uppercase', fontWeight: 700 }}>Vai trò: {userRole}</span>
          </div>
          <div className="system-status">
            <div className="status-dot"></div>
            <span>Hệ thống hoạt động bình thường</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="logout-header-btn" 
            title="Đăng xuất"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(244, 63, 94, 0.1)',
              color: '#f43f5e',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              height: '34px',
              boxSizing: 'border-box'
            }}
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon-wrapper">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <h3>Thiết bị giám sát</h3>
            <p className="stat-value">{stats.devices}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="icon-wrapper alert">
            <Zap size={24} />
          </div>
          <div className="stat-info">
            <h3>Cảnh báo an ninh</h3>
            <p className="stat-value">{stats.alerts}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="icon-wrapper incident">
            <ShieldAlert size={24} />
          </div>
          <div className="stat-info">
            <h3>Sự cố cần xử lý</h3>
            <p className="stat-value">{stats.incidents}</p>
          </div>
        </div>
      </div>

      {/* Main Content: Split tree and details */}
      {loading ? (
        <div className="loading-state" style={{ color: '#8b949e', padding: '100px 0', textAlign: 'center', fontSize: '16px' }}>
          Đang tải thông tin hệ thống giám sát...
        </div>
      ) : (
        <div className="dashboard-content-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '25px', marginTop: '20px' }}>
          
          {/* Left: Device Tree */}
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>
                Sơ đồ hệ thống & Trạng thái thiết bị
              </h2>
              <button 
                onClick={() => fetchDashboardData(false)} 
                style={{ background: 'none', border: 'none', color: '#39ff14', cursor: 'pointer', display: 'flex', gap: '5px', alignItems: 'center' }}
                title="Tải lại thiết bị"
              >
                <RefreshCw size={16} />
                <span>Tải lại</span>
              </button>
            </div>

            {devices.some(d => d.status === 'quarantined') && (
              <div 
                className="batch-warning-banner"
                style={{
                  background: 'rgba(255, 0, 60, 0.08)',
                  border: '1px dashed #ff003c',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  animation: 'banner-pulse 2s infinite ease-in-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff003c', fontWeight: '700', fontSize: '13px' }}>
                  <ShieldAlert size={18} />
                  <span>PHÁT HIỆN TẤN CÔNG ĐỒNG LOẠT!</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#c9d1d9', lineHeight: '1.4' }}>
                  Hệ thống phát hiện có <strong>{devices.filter(d => d.status === 'quarantined').length} thiết bị</strong> đang bị tấn công. Hãy kích hoạt cách ly khẩn cấp ngay để tránh lây nhiễm diện rộng.
                </p>
                <button
                  onClick={handleIsolateAllQuarantined}
                  disabled={!canRespond}
                  title={!canRespond ? "Yêu cầu tài khoản Admin hoặc L3 SOC Manager để thực hiện" : "Cách ly toàn bộ thiết bị đang bị tấn công"}
                  style={{
                    background: '#ff003c',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: canRespond ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    textTransform: 'uppercase',
                    boxShadow: '0 0 10px rgba(255, 0, 60, 0.4)',
                    transition: 'transform 0.1s',
                    opacity: canRespond ? 1 : 0.5
                  }}
                >
                  <ShieldAlert size={14} />
                  <span>CÔ LẬP ĐỒNG LOẠT ({devices.filter(d => d.status === 'quarantined').length})</span>
                </button>
              </div>
            )}

            <div className="system-tree-wrapper" style={{ overflowY: 'auto', maxHeight: '600px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {['Zone-A', 'Zone-B', 'Zone-C'].map(zone => {
                const zoneDevices = devices.filter(d => d.zone === zone);
                const rootGateways = zoneDevices.filter(d => d.node_type === 'gateway');
                const isCollapsed = collapsedZones[zone];

                return (
                  <div key={zone} className="zone-branch" style={{
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)'
                  }}>
                    <div 
                      className="zone-branch-header" 
                      onClick={() => toggleZone(zone)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      <span className="zone-title" style={{ fontWeight: 600, color: '#e6edf3', fontSize: '0.95rem' }}>
                        {zone} ({zoneDevices.length} thiết bị)
                      </span>
                    </div>

                    {!isCollapsed && (
                      <div className="zone-branch-content" style={{
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.03)'
                      }}>
                        {rootGateways.map(gw => renderTreeNode(gw, 0))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Device Detail Control Panel */}
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2>
              Chi tiết & Điều khiển an ninh
            </h2>

            {!selectedDevice ? (
              <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8b949e', paddingTop: '100px', paddingBottom: '100px' }}>
                <ShieldCheck size={48} style={{ color: '#8b949e', marginBottom: '15px' }} />
                <p style={{ margin: 0, textAlign: 'center', fontSize: '14px' }}>
                  Chọn một thiết bị từ sơ đồ bên trái để xem chi tiết và thực hiện cô lập an ninh.
                </p>
              </div>
            ) : (
              <div className="detail-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="detail-header" style={{ borderBottom: '1px solid #2d3748', paddingBottom: '15px' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#fff' }}>{selectedDevice.name}</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>Mã định danh: {selectedDevice._id}</p>
                </div>

                {/* Hiển thị điểm rủi ro Risk Score */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '12px 15px', borderRadius: '6px', marginBottom: '5px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>ĐIỂM RỦI RO THIẾT BỊ (RISK SCORE)</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ 
                      fontSize: '28px', 
                      fontWeight: 'bold', 
                      color: selectedDevice.status === 'quarantined' ? '#ff003c' : selectedDevice.status === 'isolated' ? '#ffaa00' : '#39ff14',
                      textShadow: `0 0 10px ${selectedDevice.status === 'quarantined' ? 'rgba(255, 0, 60, 0.2)' : selectedDevice.status === 'isolated' ? 'rgba(255, 170, 0, 0.2)' : 'rgba(57, 255, 20, 0.2)'}`
                    }}>
                      {selectedDevice.status === 'quarantined' ? 95 : selectedDevice.status === 'isolated' ? 20 : (selectedDevice.node_type === 'controller' ? 15 : 10)} / 100
                    </span>
                    <span style={{ fontSize: '11px', color: '#8b949e', lineHeight: '1.4' }}>
                      {selectedDevice.status === 'quarantined' ? '(Phát hiện mối đe dọa trực tiếp - Mức độ Nguy hiểm)' :
                       selectedDevice.status === 'isolated' ? '(Mối đe dọa được cô lập - Rủi ro được giảm thiểu)' :
                       '(Bình thường - Chỉ tồn tại rủi ro từ CVE hiện hữu)'}
                    </span>
                  </div>
                </div>

                <div className="device-meta-info" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8b949e' }}>Địa chỉ IP:</span>
                    <span style={{ fontWeight: 600 }}>{selectedDevice.ipAddress}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8b949e' }}>Địa chỉ MAC:</span>
                    <span style={{ fontFamily: 'monospace' }}>{selectedDevice.macAddress}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8b949e' }}>Phân vùng (Zone):</span>
                    <span>{selectedDevice.zone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8b949e' }}>Loại thiết bị:</span>
                    <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{selectedDevice.node_type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8b949e' }}>Phiên bản Firmware:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedDevice.firmware_version || 'v1.0.0'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8b949e' }}>Trạng thái mạng:</span>
                    <span style={{
                      fontWeight: 700,
                      color: selectedDevice.status === 'quarantined' ? '#ff003c' : selectedDevice.status === 'isolated' ? '#ffaa00' : '#39ff14'
                    }}>
                      {selectedDevice.status === 'active' ? 'Bình thường' : selectedDevice.status === 'quarantined' ? 'Bị Tấn Công' : selectedDevice.status === 'isolated' ? 'Đang Cô Lập' : selectedDevice.status}
                    </span>
                  </div>
                  
                  {/* Render CVE Vulnerability details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '5px' }}>
                    <span style={{ color: '#8b949e', fontSize: '13px', fontWeight: 600 }}>Lỗ hổng bảo mật liên đới:</span>
                    {selectedDevice.cves && selectedDevice.cves.length > 0 ? (
                      selectedDevice.cves.map((cve, idx) => (
                        <div key={idx} style={{ 
                          fontSize: '11px', 
                          padding: '6px 10px', 
                          borderRadius: '4px', 
                          background: cve.severity === 'CRITICAL' ? 'rgba(255,0,60,0.06)' : cve.severity === 'HIGH' ? 'rgba(255,170,0,0.06)' : 'rgba(57,255,20,0.04)',
                          border: `1px solid ${cve.severity === 'CRITICAL' ? 'rgba(255,0,60,0.2)' : cve.severity === 'HIGH' ? 'rgba(255,170,0,0.2)' : 'rgba(57,255,20,0.1)'}`,
                          color: cve.severity === 'CRITICAL' ? '#ff3b30' : cve.severity === 'HIGH' ? '#ff9500' : '#8b949e',
                          lineHeight: '1.4'
                        }}>
                          <strong style={{ display: 'block', marginBottom: '2px' }}>⚠️ {cve.cve} ({cve.severity} - Score: {cve.score})</strong>
                          <span style={{ color: '#c9d1d9' }}>{cve.desc}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#39ff14', fontSize: '12px' }}>✓ Không phát hiện lỗ hổng nghiêm trọng</span>
                    )}
                  </div>
                </div>

                {/* Threat Mitigation Control Actions */}
                <div className="security-actions-area" style={{ borderTop: '1px solid #2d3748', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '13px', color: '#8b949e' }}>
                    Hành động khẩn cấp (Threat Response)
                  </h4>

                  {selectedDevice.status === 'quarantined' ? (
                    <button 
                      onClick={() => handleIsolateDevice(selectedDevice._id)}
                      disabled={!canRespond}
                      title={!canRespond ? "Yêu cầu vai trò Admin hoặc L3 SOC Manager" : "Kích hoạt cô lập để chặn lây lan"}
                      className="ai-btn"
                      style={{
                        background: '#ffaa00',
                        color: '#000',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '4px',
                        fontWeight: '700',
                        cursor: canRespond ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        textTransform: 'uppercase',
                        boxShadow: '0 0 10px rgba(255, 170, 0, 0.3)',
                        opacity: canRespond ? 1 : 0.5
                      }}
                    >
                      <ShieldAlert size={18} />
                      <span>Kích hoạt Cô Lập Khẩn Cấp</span>
                    </button>
                  ) : selectedDevice.status === 'isolated' ? (
                    <button 
                      onClick={() => handleUnisolateDevice(selectedDevice._id)}
                      disabled={!canRespond}
                      title={!canRespond ? "Yêu cầu vai trò Admin hoặc L3 SOC Manager" : "Khôi phục kết nối cho thiết bị"}
                      className="ai-btn"
                      style={{
                        background: '#39ff14',
                        color: '#000',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '4px',
                        fontWeight: '700',
                        cursor: canRespond ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        textTransform: 'uppercase',
                        boxShadow: '0 0 10px rgba(57, 255, 20, 0.3)',
                        opacity: canRespond ? 1 : 0.5
                      }}
                    >
                      <Cpu size={18} />
                      <span>Phục Hồi Kết Nối Thiết Bị</span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ color: '#8b949e', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '5px' }}>
                        Thiết bị hoạt động an toàn.
                      </div>
                      <button 
                        onClick={() => handleIsolateDevice(selectedDevice._id)}
                        disabled={!canRespond}
                        title={!canRespond ? "Yêu cầu vai trò Admin hoặc L3 SOC Manager" : "Cô lập phòng ngừa chủ động"}
                        style={{
                          background: '#1f293d',
                          color: '#e6edf3',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '10px',
                          borderRadius: '4px',
                          fontWeight: '600',
                          cursor: canRespond ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          textTransform: 'uppercase',
                          transition: 'background-color 0.2s',
                          opacity: canRespond ? 1 : 0.5
                        }}
                      >
                        <ShieldAlert size={16} />
                        <span>Cô Lập Thiết Bị (Proactive)</span>
                      </button>
                    </div>
                  )}

                  {/* PLC Safe-Mode Rollback Button */}
                  {selectedDevice.node_type === 'controller' && (
                    <button 
                      onClick={() => handleRollbackDevice(selectedDevice._id)}
                      disabled={!canRollback}
                      title={!canRollback ? "Yêu cầu vai trò Admin, L3 SOC Manager hoặc OT Operator" : "Phục hồi chương trình an toàn gốc cho PLC"}
                      style={{
                        background: 'rgba(57, 255, 20, 0.05)',
                        color: '#39ff14',
                        border: '1px solid rgba(57, 255, 20, 0.4)',
                        padding: '11px',
                        borderRadius: '4px',
                        fontWeight: '700',
                        cursor: canRollback ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        textTransform: 'uppercase',
                        opacity: canRollback ? 1 : 0.5,
                        transition: 'all 0.2s',
                        marginTop: '5px',
                        boxShadow: '0 0 5px rgba(57, 255, 20, 0.1)'
                      }}
                    >
                      <RefreshCw size={16} />
                      <span>Nạp Lại Logic Safe-Mode</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default Dashboard;
