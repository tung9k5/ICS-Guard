import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import http from '@/http/clients/api';
import { 
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, 
  ToggleLeft, ToggleRight, Volume2, Fan, Bell, ShieldAlert, Play, Square,
  ChevronDown, ChevronRight, RefreshCw, Activity, ShieldCheck, LogOut
} from 'lucide-react';
import authApi from '@/api/auth';
import './AttackerConsole.scss';

const ATTACK_SCENARIOS = {
  gateway: [
    { type: 'wan_dos', name: 'Tấn công Từ chối dịch vụ WAN (WAN DoS)', desc: 'Spam handshake TLS làm cạn kiệt tài nguyên xử lý của Gateway.' },
    { type: 'route_poisoning', name: 'Đầu độc định tuyến (Route Poisoning)', desc: 'Chèn tuyến tĩnh giả mạo chuyển hướng lưu lượng về IP hacker.' }
  ],
  controller: [
    { type: 'logic_tampering', name: 'Thay đổi Logic Ladder (Logic Tampering)', desc: 'Ghi đè chương trình điều khiển OB1 trên PLC gây lỗi Checksum.' },
    { type: 'modbus_flooding', name: 'Tràn kết nối Modbus TCP (Modbus Flood)', desc: 'Mở hàng loạt session Modbus TCP giả mạo làm treo cổng 502.' }
  ],
  chip: [
    { type: 'ota_tampering', name: 'Nạp Firmware độc hại qua OTA', desc: 'Mạo danh máy chủ OTA gửi firmware sai chữ ký số làm hỏng phân vùng nạp.' },
    { type: 'watchdog_reset', name: 'Kích hoạt lỗi Watchdog (WDT Reset)', desc: 'Kích hoạt vòng lặp vô hạn làm tràn bộ nhớ Heap và reset chip nhúng.' }
  ],
  sensor: [
    { type: 'sensor_spoofing', name: 'Giả mạo dữ liệu ADC (Data Spoofing)', desc: 'Chèn chỉ số điện áp giả lập gây báo động giả trị vật lý vượt ngưỡng.' },
    { type: 'signal_loss', name: 'Gây nhiễu ngắt sóng cảm biến (Signal Loss)', desc: 'Làm mất gói tin truyền dẫn vô tuyến gây ngoại tuyến (Offline) thiết bị.' }
  ],
  actuator: [
    { type: 'command_flooding', name: 'Gửi dồn dập lệnh điều khiển (Wear & Tear)', desc: 'Gửi liên tiếp lệnh đóng/mở làm quá tải động cơ và kẹt phần cứng.' },
    { type: 'unauthorized_actuation', name: 'Kích hoạt van/rơ-le trái phép', desc: 'Bỏ qua logic bảo vệ của PLC ghi trực tiếp lệnh kích hoạt cơ cấu chấp hành.' }
  ]
};

const getIcon = (iconName) => {
  switch (iconName) {
    case 'Network': return <Network size={16} />;
    case 'Cpu': return <Cpu size={16} />;
    case 'Radio': return <Radio size={16} />;
    case 'Thermometer': return <Thermometer size={16} />;
    case 'Droplets': return <Droplets size={16} />;
    case 'Zap': return <Zap size={16} />;
    case 'Wind': return <Wind size={16} />;
    case 'Gauge': return <Gauge size={16} />;
    case 'ToggleLeft': return <ToggleLeft size={16} />;
    case 'ToggleRight': return <ToggleRight size={16} />;
    case 'Volume2': return <Volume2 size={16} />;
    case 'Fan': return <Fan size={16} />;
    case 'Bell': return <Bell size={16} />;
    default: return <Activity size={16} />;
  }
};

const AttackerConsole = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [selectedAttacks, setSelectedAttacks] = useState({}); // format: { [device_type]: attack_type }
  const [triggering, setTriggering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [collapsedZones, setCollapsedZones] = useState({ 'Zone-B': true, 'Zone-C': true });

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('attacker_refresh_token');
      if (refreshToken) {
        await authApi.logout({ refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('attacker_access_token');
      localStorage.removeItem('attacker_refresh_token');
      navigate('/attacker/login');
    }
  };

  const fetchDevices = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await http.get('/devices');
      if (Array.isArray(res)) {
        setDevices(res);
        // Automatically de-select any nodes that became isolated
        setSelectedNodes(prev => prev.filter(id => {
          const dev = res.find(d => d._id === id);
          return dev && dev.status !== 'isolated';
        }));
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách thiết bị:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchDevices(true);
  }, []);

  // Auto refresh devices silently every 2 seconds to synchronize status with SOC Dashboard
  useEffect(() => {
    const interval = setInterval(() => fetchDevices(false), 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleZone = (zoneName) => {
    setCollapsedZones(prev => ({
      ...prev,
      [zoneName]: !prev[zoneName]
    }));
  };

  const handleSelectNode = (id) => {
    setSelectedNodes(prev => {
      if (prev.includes(id)) {
        return prev.filter(nodeId => nodeId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAttack = (nodeType, attackType) => {
    setSelectedAttacks(prev => ({
      ...prev,
      [nodeType]: attackType
    }));
  };

  const handleSelectAllInBranch = (parentDevice, deviceList) => {
    // Collect all children recursively
    const collectChildrenIds = (dev) => {
      let ids = [dev._id];
      const children = deviceList.filter(d => d.parent_id === dev._id);
      children.forEach(c => {
        ids = [...ids, ...collectChildrenIds(c)];
      });
      return ids;
    };

    const branchIds = collectChildrenIds(parentDevice);
    
    // Filter out isolated devices from branchIds to prevent selecting them
    const nonIsolatedBranchIds = branchIds.filter(id => {
      const dev = deviceList.find(d => d._id === id);
      return dev && dev.status !== 'isolated';
    });

    const allSelected = nonIsolatedBranchIds.length > 0 && nonIsolatedBranchIds.every(id => selectedNodes.includes(id));

    if (allSelected) {
      // Uncheck all in branch
      setSelectedNodes(prev => prev.filter(id => !nonIsolatedBranchIds.includes(id)));
    } else {
      // Check all in branch (avoid duplicates)
      setSelectedNodes(prev => {
        const unique = new Set([...prev, ...nonIsolatedBranchIds]);
        return Array.from(unique);
      });
    }
  };

  const handleLaunchAttack = async () => {
    if (selectedNodes.length === 0) {
      alert('Vui lòng chọn ít nhất một thiết bị mục tiêu từ cây sơ đồ hệ thống.');
      return;
    }

    // Identify device types selected
    const selectedDevices = devices.filter(d => selectedNodes.includes(d._id));
    const typesToAttack = Array.from(new Set(selectedDevices.map(d => d.node_type)));

    // Check if attacks are selected for each type
    const missingAttackTypes = typesToAttack.filter(type => !selectedAttacks[type]);
    if (missingAttackTypes.length > 0) {
      alert(`Vui lòng cấu hình kịch bản tấn công cho nhóm thiết bị: ${missingAttackTypes.map(t => t.toUpperCase()).join(', ')}`);
      return;
    }

    try {
      setTriggering(true);
      setSuccessMsg('');

      // Send attack commands in parallel for each target
      const attackPromises = selectedDevices.map(device => {
        const attack_type = selectedAttacks[device.node_type];
        return http.post('/telemetry/control-attack', {
          device_id: device._id,
          attack_type
        });
      });

      await Promise.all(attackPromises);
      setSuccessMsg(`🚀 Đã khởi động chiến dịch tấn công thành công trên ${selectedDevices.length} thiết bị!`);
      fetchDevices(); // refresh status
    } catch (error) {
      console.error('Lỗi khi kích hoạt tấn công:', error);
      alert('Kích hoạt chiến dịch tấn công thất bại. Vui lòng kiểm tra kết nối Backend API.');
    } finally {
      setTriggering(false);
    }
  };

  const handleStopAttack = async () => {
    if (selectedNodes.length === 0) {
      alert('Vui lòng chọn các thiết bị cần ngăn chặn/dừng tấn công.');
      return;
    }

    try {
      setTriggering(true);
      setSuccessMsg('');

      const selectedDevices = devices.filter(d => selectedNodes.includes(d._id));
      const stopPromises = selectedDevices.map(device => {
        return http.post('/telemetry/control-attack', {
          device_id: device._id,
          attack_type: 'stop'
        });
      });

      await Promise.all(stopPromises);
      setSuccessMsg(`✅ Đã dừng tấn công và phục hồi trạng thái cho ${selectedDevices.length} thiết bị!`);
      fetchDevices();
    } catch (error) {
      console.error('Lỗi khi dừng tấn công:', error);
      alert('Dừng tấn công thất bại.');
    } finally {
      setTriggering(false);
    }
  };

  // Group devices by Zone
  const zones = ['Zone-A', 'Zone-B', 'Zone-C'];
  
  // Recursively render device tree
  const renderTreeNode = (device, level = 0) => {
    const children = devices.filter(d => d.parent_id === device._id);
    const hasChildren = children.length > 0;
    const isSelected = selectedNodes.includes(device._id);
    const isIsolated = device.status === 'isolated';

    return (
      <div key={device._id} className="tree-node-wrapper" style={{ marginLeft: `${level * 15}px` }}>
        <div className={`tree-node-item ${isIsolated ? 'node-isolated-disabled' : ''}`}>
          <input 
            type="checkbox" 
            checked={isSelected && !isIsolated}
            onChange={() => handleSelectNode(device._id)}
            disabled={isIsolated}
            className="node-checkbox"
            title={isIsolated ? "Thiết bị đã bị cô lập mạng, không thể tấn công" : "Chọn thiết bị"}
          />
          
          {hasChildren && (
            <button 
              onClick={() => handleSelectAllInBranch(device, devices)}
              className="select-branch-btn"
              disabled={isIsolated}
              title={isIsolated ? "Thiết bị đầu nhánh đã bị cô lập" : "Chọn toàn bộ nhánh phụ thuộc"}
            >
              *
            </button>
          )}

          <div className={`node-icon ${device.status}`}>
            {getIcon(device.icon_path)}
          </div>

          <div className="node-info">
            <span className="node-name" style={{ textDecoration: isIsolated ? 'line-through' : 'none', opacity: isIsolated ? 0.6 : 1 }}>
              {device.name}
            </span>
            <span className="node-id">({device._id})</span>
            <span className={`node-badge-type node-type-${device.node_type}`}>
              {device.node_type}
            </span>
            {device.status !== 'active' && (
              <span className={`node-badge-status status-${device.status}`}>
                {device.status === 'quarantined' ? 'Bị tấn công' : device.status === 'isolated' ? 'Đã cô lập' : device.status}
              </span>
            )}
          </div>
        </div>
        
        {hasChildren && (
          <div className="node-children">
            {children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get selected nodes count by node_type
  const getSelectedTypeCounts = () => {
    const counts = { gateway: 0, controller: 0, chip: 0, sensor: 0, actuator: 0 };
    devices.filter(d => selectedNodes.includes(d._id)).forEach(d => {
      if (counts[d.node_type] !== undefined) {
        counts[d.node_type]++;
      }
    });
    return counts;
  };

  const selectedCounts = getSelectedTypeCounts();
  const totalSelected = selectedNodes.length;
  const selectedDevices = devices.filter(d => selectedNodes.includes(d._id));
  const isAnyUnderAttack = selectedDevices.some(d => d.status === 'quarantined' || d.status === 'isolated');

  return (
    <div className="attacker-console-container">
      {/* Header */}
      <div className="console-header">
        <div className="header-title-area">
          <ShieldAlert size={28} className="pulse-icon red" />
          <h1>ICS-Guard Attacker Control Panel</h1>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button className="refresh-btn" onClick={fetchDevices} title="Tải lại thiết bị">
            <RefreshCw size={18} />
            <span>Làm mới</span>
          </button>
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

      {successMsg && (
        <div className="success-banner">
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Đang tải cấu trúc sơ đồ hệ thống IoT...</div>
      ) : (
        <div className="console-split-layout">
          
          {/* Left panel: System Tree */}
          <div className="console-panel left-panel">
            <h2>Sơ đồ phân tầng hệ thống IoT</h2>
            <p className="panel-desc">Tích chọn các thiết bị làm mục tiêu tấn công hoặc click dấu `*` để chọn toàn bộ nhánh con.</p>
            
            <div className="system-tree-wrapper">
              {zones.map(zone => {
                const zoneDevices = devices.filter(d => d.zone === zone);
                const rootGateways = zoneDevices.filter(d => d.node_type === 'gateway');
                const isCollapsed = collapsedZones[zone];

                return (
                  <div key={zone} className="zone-branch">
                    <div className="zone-branch-header" onClick={() => toggleZone(zone)}>
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      <span className="zone-title">{zone} ({zoneDevices.length} thiết bị)</span>
                    </div>

                    {!isCollapsed && (
                      <div className="zone-branch-content">
                        {rootGateways.map(gw => renderTreeNode(gw, 0))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel: Attack Configurator */}
          <div className="console-panel right-panel">
            <h2>Cấu hình kịch bản tấn công</h2>
            
            {totalSelected === 0 ? (
              <div className="empty-attack-state">
                <ShieldCheck size={48} className="shield-ok-icon" />
                <p>Chưa chọn mục tiêu. Vui lòng tích chọn thiết bị ở cây sơ đồ để thiết lập kịch bản.</p>
              </div>
            ) : (
              <div className="attack-configurator">
                <div className="targets-summary">
                  <h3>Mục tiêu đang chọn ({totalSelected}):</h3>
                  <div className="summary-badges">
                    {Object.entries(selectedCounts).map(([type, count]) => {
                      if (count === 0) return null;
                      return (
                        <span key={type} className={`summary-badge node-type-${type}`}>
                          {type.toUpperCase()}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Categorized Attack Scenarios based on selected targets */}
                <div className="categorized-attack-list">
                  {Object.entries(selectedCounts).map(([type, count]) => {
                    if (count === 0) return null;
                    const scenarios = ATTACK_SCENARIOS[type] || [];

                    return (
                      <div key={type} className="attack-group-box">
                        <div className={`attack-group-header node-type-${type}`}>
                          <h4>Kịch bản tấn công cho nhóm {type.toUpperCase()} ({count} node)</h4>
                        </div>
                        <div className="attack-group-options">
                          {scenarios.map(sc => {
                            const isChosen = selectedAttacks[type] === sc.type;
                            return (
                              <div 
                                key={sc.type} 
                                className={`attack-option-card ${isChosen ? 'selected' : ''}`}
                                onClick={() => handleSelectAttack(type, sc.type)}
                              >
                                <div className="card-header">
                                  <span className="radio-dot"></span>
                                  <span className="attack-title">{sc.name}</span>
                                </div>
                                <p className="attack-desc">{sc.desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Command Actions */}
                <div className="attack-actions-panel">
                  {isAnyUnderAttack ? (
                    <button 
                      onClick={handleStopAttack} 
                      className="action-btn stop-btn"
                      disabled={triggering}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Square size={20} />
                      <span>DỪNG TẤN CÔNG (RESTORE)</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleLaunchAttack} 
                      className="action-btn launch-btn"
                      disabled={triggering}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Play size={20} />
                      <span>KÍCH HOẠT TẤN CÔNG ĐỒNG LOẠT</span>
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

export default AttackerConsole;
