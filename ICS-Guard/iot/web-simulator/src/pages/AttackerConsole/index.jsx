import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiAttacks from '@/api/attacks';
import { 
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, 
  ToggleLeft, ToggleRight, Volume2, Fan, Bell, ShieldAlert, Play, Square,
  ChevronDown, ChevronRight, RefreshCw, Activity, ShieldCheck, LogOut
} from 'lucide-react';
import './AttackerConsole.scss';

const ACTIVE_RUNS_KEY = 'ics_guard_active_attack_runs';

const loadActiveRuns = () => {
  try {
    const value = JSON.parse(sessionStorage.getItem(ACTIVE_RUNS_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
};

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
  const [collapsedZones, setCollapsedZones] = useState({});
  const [activeRunIds, setActiveRunIds] = useState(loadActiveRuns);

  const handleLogout = () => {
    localStorage.removeItem('attacker_access_token');
    localStorage.removeItem('attacker_refresh_token');
    sessionStorage.removeItem(ACTIVE_RUNS_KEY);
    navigate('/attacker/login');
  };

  const fetchDevices = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await ApiAttacks.getDevices();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);

      const normalized = list.map((device) => {
        const id = device._id ?? device.id ?? device.device_id;
        const parentId = device.parent_id ?? device.parentId ?? null;
        return {
        ...device,
        _id: id == null ? '' : String(id),
        name: device.name || id || 'Device',
        node_type: device.node_type || device.type || 'sensor',
        zone: device.zone || 'Zone-A',
        status: device.status || device.operational_status || 'active',
        parent_id: parentId == null || parentId === '' ? null : String(parentId),
      };
      }).filter(device => device._id);
      setDevices(normalized);
      setActiveRunIds((previous) => {
        const next = { ...previous };
        normalized.forEach((device) => {
          if (device.active_run_id) next[device._id] = device.active_run_id;
        });
        return next;
      });
      setSelectedNodes(prev => prev.filter(id => {
        const dev = normalized.find(d => d._id === id);
        return dev && dev.status !== 'isolated';
      }));
    } catch (error) {
      console.error('Lỗi khi tải danh sách thiết bị:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchDevices(false), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(ACTIVE_RUNS_KEY, JSON.stringify(activeRunIds));
  }, [activeRunIds]);

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
    const collectChildrenIds = (dev) => {
      let ids = [dev._id];
      const children = deviceList.filter(d => d.parent_id === dev._id);
      children.forEach(c => {
        ids = [...ids, ...collectChildrenIds(c)];
      });
      return ids;
    };

    const branchIds = collectChildrenIds(parentDevice);
    
    const nonIsolatedBranchIds = branchIds.filter(id => {
      const dev = deviceList.find(d => d._id === id);
      return dev && dev.status !== 'isolated';
    });

    const allSelected = nonIsolatedBranchIds.length > 0 && nonIsolatedBranchIds.every(id => selectedNodes.includes(id));

    if (allSelected) {
      setSelectedNodes(prev => prev.filter(id => !nonIsolatedBranchIds.includes(id)));
    } else {
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

    const selectedDevices = devices.filter(d => selectedNodes.includes(d._id));
    const typesToAttack = Array.from(new Set(selectedDevices.map(d => d.node_type)));

    const missingAttackTypes = typesToAttack.filter(type => !selectedAttacks[type]);
    if (missingAttackTypes.length > 0) {
      alert(`Vui lòng cấu hình kịch bản tấn công cho nhóm thiết bị: ${missingAttackTypes.map(t => t.toUpperCase()).join(', ')}`);
      return;
    }

    try {
      setTriggering(true);
      setSuccessMsg('');

      const attackResults = await Promise.all(selectedDevices.map((device) =>
        ApiAttacks.launchAttack(device._id, selectedAttacks[device.node_type])
      ));
      setActiveRunIds((previous) => {
        const next = { ...previous };
        attackResults.forEach((response, index) => {
          const run = response?.data || response;
          if (run?.run_id) next[selectedDevices[index]._id] = run.run_id;
        });
        return next;
      });
      setSuccessMsg(`🚀 Đã khởi động chiến dịch tấn công thành công trên ${selectedDevices.length} thiết bị!`);
      fetchDevices();
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

      const selectedDevices = devices.filter((device) =>
        selectedNodes.includes(device._id) &&
        Boolean(activeRunIds[device._id] || device.active_run_id)
      );
      if (selectedDevices.length === 0) {
        setSuccessMsg('No active attack lease exists on the selected targets.');
        return;
      }
      await Promise.all(selectedDevices.map((device) =>
        ApiAttacks.stopRun(activeRunIds[device._id] || device.active_run_id)
      ));
      setActiveRunIds((previous) => {
        const next = { ...previous };
        selectedDevices.forEach((device) => delete next[device._id]);
        return next;
      });
      setSuccessMsg(`✅ Đã dừng tấn công và phục hồi trạng thái cho ${selectedDevices.length} thiết bị!`);
      fetchDevices();
    } catch (error) {
      console.error('Lỗi khi dừng tấn công:', error);
      alert('Dừng tấn công thất bại.');
    } finally {
      setTriggering(false);
    }
  };

  const zones = Array.from(new Set([
    'Zone-A', 'Zone-B', 'Zone-C',
    ...devices.map(device => device.zone).filter(Boolean),
  ]));
  
  const deviceMap = React.useMemo(() => Object.fromEntries(devices.map(d => [d._id, d])), [devices]);

  const isDeviceReachable = (deviceId) => {
    let current = deviceMap[deviceId];
    const visited = new Set();
    while (current) {
      if (visited.has(current._id)) break;
      visited.add(current._id);
      if (current.status === 'offline' || current.status === 'isolated') return false;
      current = current.parent_id ? deviceMap[current.parent_id] : null;
    }
    return true;
  };

  const renderTreeNode = (device, level = 0, ancestors = new Set()) => {
    if (ancestors.has(device._id)) return null;
    const nextAncestors = new Set(ancestors).add(device._id);
    const children = devices.filter(d => d.parent_id === device._id && d.zone === device.zone);
    const hasChildren = children.length > 0;
    const isSelected = selectedNodes.includes(device._id);
    
    const reachable = isDeviceReachable(device._id);
    const isOffline = device.status === 'offline';
    const isIsolated = device.status === 'isolated';
    const isUnreachable = !reachable && !isOffline && !isIsolated;
    const isDisabled = isIsolated || isOffline || isUnreachable;

    const disabledTitle = isIsolated
      ? "Thiết bị đã bị cô lập mạng, không thể tấn công"
      : isOffline
      ? "Thiết bị đang Offline (Rút dây / Ngắt nguồn)"
      : isUnreachable
      ? "Thiết bị mất kết nối truyền dẫn từ node cha"
      : "Chọn thiết bị mục tiêu";

    return (
      <div key={device._id} className="tree-node-wrapper" style={{ marginLeft: `${level * 15}px` }}>
        <div className={`tree-node-item ${isDisabled ? 'node-isolated-disabled' : ''}`}>
          <input 
            type="checkbox" 
            checked={isSelected && !isDisabled}
            onChange={() => handleSelectNode(device._id)}
            disabled={isDisabled}
            className="node-checkbox"
            title={disabledTitle}
          />
          
          {hasChildren && (
            <button 
              onClick={() => handleSelectAllInBranch(device, devices)}
              className="select-branch-btn"
              disabled={isDisabled}
              title={isDisabled ? disabledTitle : "Chọn toàn bộ nhánh phụ thuộc"}
            >
              *
            </button>
          )}

          <div className={`node-icon ${device.status}`}>
            {getIcon(device.icon_path)}
          </div>

          <div className="node-info">
            <span className="node-name" style={{ textDecoration: isDisabled ? 'line-through' : 'none', opacity: isDisabled ? 0.6 : 1 }}>
              {device.name}
            </span>
            <span className="node-id">({device._id})</span>
            <span className={`node-badge-type node-type-${device.node_type}`}>
              {device.node_type}
            </span>
            {device.status !== 'active' && (
              <span className={`node-badge-status status-${device.status}`}>
                {device.status === 'quarantined' ? 'Bị tấn công' : device.status === 'isolated' ? 'Đã cô lập' : isOffline ? 'Offline' : device.status}
              </span>
            )}
            {isUnreachable && (
              <span className="node-badge-status status-unreachable" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                Mất tín hiệu cha
              </span>
            )}
          </div>
        </div>
        
        {hasChildren && (
          <div className="node-children">
            {children.map(child => renderTreeNode(child, level + 1, nextAncestors))}
          </div>
        )}
      </div>
    );
  };

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
                const zoneDevices = devices.filter(d => {
                  const deviceZone = (d.zone || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                  const targetZone = zone.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return deviceZone === targetZone;
                });
                const zoneIds = new Set(zoneDevices.map(device => device._id));
                const rootDevices = zoneDevices.filter(device =>
                  !device.parent_id || !zoneIds.has(device.parent_id)
                );
                const isCollapsed = collapsedZones[zone];

                return (
                  <div key={zone} className="zone-branch">
                    <div className="zone-branch-header" onClick={() => toggleZone(zone)}>
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      <span className="zone-title">{zone} ({zoneDevices.length} thiết bị)</span>
                    </div>

                    {!isCollapsed && (
                      <div className="zone-branch-content">
                        {rootDevices.length > 0
                          ? rootDevices.map(gw => renderTreeNode(gw, 0))
                          : <div style={{ padding: '8px 12px', color: '#64748b', fontSize: '12px' }}>Không có thiết bị nào trong zone này.</div>
                        }
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
                <div className="attack-actions-panel" style={{ display: 'flex', gap: '1rem', flexDirection: 'row' }}>
                  <button 
                    onClick={handleLaunchAttack} 
                    className="action-btn launch-btn"
                    disabled={triggering}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Play size={20} />
                    <span>KÍCH HOẠT TẤN CÔNG</span>
                  </button>
                  <button 
                    onClick={handleStopAttack} 
                    className="action-btn stop-btn"
                    disabled={triggering}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Square size={20} />
                    <span>DỪNG TẤN CÔNG (RESTORE)</span>
                  </button>
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
