import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiAttacks from '@/api/attacks';
import { 
  Network, Cpu, Radio, Thermometer, Droplets, Zap, Wind, Gauge, 
  ToggleLeft, ToggleRight, Volume2, Fan, Bell, ShieldAlert, Play, Square,
  ChevronDown, ChevronRight, RefreshCw, Activity, ShieldCheck, LogOut,
  AlertTriangle, WifiOff
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
  controller: [
    { type: 'modbus_overwrite', name: 'Ghi đè Thanh ghi Modbus FC06/FC05', desc: 'Ép đóng van xả khẩn cấp nhưng bơm vẫn chạy -> Áp suất vọt 18 bar -> Nổ vỡ đường ống vật lý (Pipe Burst).' },
    { type: 'plc_scan_stop', name: 'Đóng băng Vòng quét PLC (OB1 Freeze / Logic Stop)', desc: 'Gửi mã ngắt khẩn cấp làm ngưng trệ vòng quét điều khiển OB1 của PLC.' },
    { type: 'ladder_tamper', name: 'Nạp Chương trình Ladder Trái Phép (Ladder Logic Upload)', desc: 'Thay đổi thuật toán điều khiển tự động trên bộ điều khiển lập trình.' },
    { type: 'modbus_flooding', name: 'Tràn kết nối Modbus TCP (Modbus Flood)', desc: 'Mở hàng loạt phiên Modbus TCP giả lập để gây nghẽn kênh điều khiển.' }
  ],
  sensor: [
    { type: 'false_telemetry_injection', name: 'Bơm Chỉ Số Cảm Biến Giả (False Telemetry Injection)', desc: 'Bơm dữ liệu nhiệt độ/áp suất giả khiến hệ thống SCADA ra quyết định sai lệch.' },
    { type: 'signal_freeze', name: 'Đóng Băng Chỉ Số Cảm Biến (Signal Freeze)', desc: 'Cố định chỉ số nhiệt độ 35°C dù thực tế 90°C -> Lò hơi tiếp tục đốt gây nổ lò hơi.' },
    { type: 'sensor_spoofing', name: 'Giả Mạo Dữ Liệu Cảm Biến (Sensor Spoofing)', desc: 'Chèn dữ liệu đo giả lập để làm lệch quyết định điều khiển và cảnh báo.' }
  ],
  actuator: [
    { type: 'rapid_oscillation', name: 'Nhấp Nhả Rơ-le Tần Suất Cao (Rapid Oscillation)', desc: 'Bật/tắt rơ-le 100 lần/phút -> Quá dòng khởi động liên tục -> Cháy động cơ vật lý (Motor Burnout).' },
    { type: 'unsolicited_override', name: 'Ghi Đè Van Chấp Hành Khẩn Cấp (Unsolicited Valve Override)', desc: 'Ép van đóng/mở trái quy trình điều khiển gây hiện tượng búa nước (Water Hammer).' }
  ]
};

const getAttackNodeType = (nodeType) => {
  const normalized = String(nodeType || '').trim().toLowerCase();
  if (normalized.includes('sensor')) return 'sensor';
  if (['actuator', 'pump', 'motor', 'breaker', 'alarm', 'valve'].some(k => normalized.includes(k))) return 'actuator';
  return 'controller';
};

const getApiErrorMessage = (error, fallback) => {
  if (error?.response?.status === 401) {
    return 'Phiên attacker đã hết hạn hoặc chưa hợp lệ. Vui lòng tải lại trang tại /attacker.';
  }
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
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
  const [selectedAttacks, setSelectedAttacks] = useState({});
  const [triggering, setTriggering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [collapsedZones, setCollapsedZones] = useState({});

  const handleLogout = () => {
    localStorage.removeItem('attacker_access_token');
    localStorage.removeItem('attacker_refresh_token');
    sessionStorage.removeItem(ACTIVE_RUNS_KEY);
    navigate('/');
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
      }).filter(device =>
        device._id &&
        device.status !== 'decommissioned' &&
        device.approval_status !== 'pending' &&
        device.approval_status !== 'rejected'
      );
      setDevices(normalized);
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
    const interval = setInterval(() => fetchDevices(false), 5000);
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

  // Chaos Mode State
  const [isChaosActive, setIsChaosActive] = useState(false);
  const [chaosIntervalSec, setChaosIntervalSec] = useState(15);
  const chaosTimerRef = useRef(null);
  const runChaosAttackWave = useCallback(async () => {
    const activeEligibleDevs = devices.filter(d =>
      d.status !== 'isolated' &&
      d.status !== 'offline' &&
      d.status !== 'decommissioned' &&
      d.approval_status !== 'pending' &&
      d.approval_status !== 'rejected'
    );

    if (activeEligibleDevs.length === 0) return;

    // Randomize 1 to 5 devices per wave
    const numTargets = Math.min(activeEligibleDevs.length, Math.floor(Math.random() * 5) + 1);
    const shuffled = [...activeEligibleDevs].sort(() => 0.5 - Math.random());
    const targetDevs = shuffled.slice(0, numTargets);

    try {
      await Promise.all(targetDevs.map(dev => {
        const scenarioId = getRandomScenarioForNode(dev.node_type);
        const randomIp = getRandomSubnetIp(dev.zone);

        return ApiAttacks.launchAttack(dev._id, scenarioId, {
          data: {
            device_id: dev._id,
            target_id: dev._id,
            scenario_id: scenarioId,
            attack_type: scenarioId,
            source_ip: randomIp
          }
        });
      }));

      setSuccessMsg(`⚡ [CHAOS MODE] Đã bắn bão tấn công tự động trên ${targetDevs.length} thiết bị ngẫu nhiên!`);
      fetchDevices();
    } catch (err) {
      console.error('[ChaosMode] Wave error:', err);
    }
  }, [devices, fetchDevices]);

  useEffect(() => {
    if (isChaosActive) {
      runChaosAttackWave();
      chaosTimerRef.current = setInterval(() => {
        runChaosAttackWave();
      }, chaosIntervalSec * 1000);
    } else {
      if (chaosTimerRef.current) clearInterval(chaosTimerRef.current);
    }
    return () => {
      if (chaosTimerRef.current) clearInterval(chaosTimerRef.current);
    };
  }, [isChaosActive, chaosIntervalSec, runChaosAttackWave]);

  const getRandomSubnetIp = (zone) => {
    const subnetMap = {
      'Zone-A': '192.168.10',
      'Zone-B': '10.0.4',
      'Zone-C': '172.16.20',
      'Default-Zone': '192.168.1'
    };
    const prefix = subnetMap[zone] || '192.168.10';
    const host = Math.floor(Math.random() * 200) + 10;
    return `${prefix}.${host}`;
  };

  const getRandomScenarioForNode = (nodeType) => {
    const group = getAttackNodeType(nodeType);
    const available = ATTACK_SCENARIOS[group] || [];
    if (available.length === 0) return 'modbus_overwrite';
    const randIdx = Math.floor(Math.random() * available.length);
    return available[randIdx].type;
  };

  const handleSelectAttack = (nodeType, attackType) => {
    if (isChaosActive) return; // Locked during Chaos Mode
    setSelectedAttacks(prev => ({
      ...prev,
      [nodeType]: prev[nodeType] === attackType ? null : attackType
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
    const typesToAttack = Array.from(new Set(selectedDevices.map(d => getAttackNodeType(d.node_type))));

    const missingAttackTypes = typesToAttack.filter(type => !selectedAttacks[type]);
    if (missingAttackTypes.length > 0) {
      alert(`Vui lòng cấu hình kịch bản tấn công cho nhóm thiết bị: ${missingAttackTypes.map(t => t.toUpperCase()).join(', ')}`);
      return;
    }

    try {
      setTriggering(true);
      setSuccessMsg('');

      await Promise.all(selectedDevices.map((device) => {
        const typeGroup = getAttackNodeType(device.node_type);
        const attackType = selectedAttacks[typeGroup] || (
          typeGroup === 'sensor' ? 'false_telemetry_injection' :
          typeGroup === 'actuator' ? 'rapid_oscillation' : 'modbus_overwrite'
        );
        return ApiAttacks.launchAttack(device._id, attackType);
      }));

      setSuccessMsg(`Đã khởi động chiến dịch tấn công thành công trên ${selectedDevices.length} thiết bị!`);
      fetchDevices();
    } catch (error) {
      console.error('Lỗi khi kích hoạt tấn công:', error);
      alert(getApiErrorMessage(error, 'Kích hoạt chiến dịch tấn công thất bại. Vui lòng kiểm tra Backend API.'));
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
    const counts = { controller: 0, sensor: 0, actuator: 0 };
    devices.filter(d => selectedNodes.includes(d._id)).forEach(d => {
      const attackType = getAttackNodeType(d.node_type);
      if (attackType && counts[attackType] !== undefined) counts[attackType]++;
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
          {/* Chaos Mode Auto Attacker Toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: isChaosActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.8)',
            border: `1px solid ${isChaosActive ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
            padding: '6px 12px', borderRadius: '8px'
          }}>
            <Zap size={18} color={isChaosActive ? '#ef4444' : '#94a3b8'} className={isChaosActive ? 'pulse-icon red' : ''} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: isChaosActive ? '#f87171' : '#cbd5e1' }}>
              TẤN CÔNG TỰ ĐỘNG (CHAOS MODE)
            </span>
            <button
              type="button"
              onClick={() => setIsChaosActive(prev => !prev)}
              style={{
                background: isChaosActive ? '#ef4444' : '#334155',
                color: '#fff', border: 'none', padding: '4px 10px',
                borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700
              }}
            >
              {isChaosActive ? 'TẮT CHAOS MODE' : 'BẬT CHAOS MODE'}
            </button>
          </div>

          <button className="refresh-btn" onClick={() => fetchDevices(true)} title="Tải lại thiết bị">
            <RefreshCw size={18} />
            <span>Làm mới</span>
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
          <div className="console-panel right-panel" style={{ position: 'relative', opacity: isChaosActive ? 0.6 : 1, pointerEvents: isChaosActive ? 'none' : 'auto' }}>
            {isChaosActive && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(15, 23, 42, 0.85)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#f87171', fontWeight: 700, borderRadius: '12px', padding: '20px', textAlign: 'center'
              }}>
                <Zap size={40} style={{ marginBottom: '12px' }} />
                <span>🔒 TẤN CÔNG TỰ ĐỘNG (CHAOS MODE) ĐANG BẬT</span>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0', fontWeight: 400 }}>
                  Bảng cấu hình thủ công tạm thời bị vô hiệu hóa để tránh xung đột mã nguồn. Hãy tắt Chaos Mode để tấn công chủ động.
                </p>
              </div>
            )}
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
