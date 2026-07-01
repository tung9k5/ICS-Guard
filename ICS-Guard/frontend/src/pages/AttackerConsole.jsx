import React, { useEffect, useState, useRef } from 'react';
import http from '@/http/clients/api';
import { Terminal, Play, AlertOctagon, RotateCcw, Link2 } from 'lucide-react';
import './AttackerConsole.scss';

const AttackerConsole = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [attackType, setAttackType] = useState('traffic_spike');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isConsoleUnlocked, setIsConsoleUnlocked] = useState(() => sessionStorage.getItem('attacker_unlocked') === 'true');
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [activeAttacks, setActiveAttacks] = useState({});

  const selectedDeviceRef = useRef(null);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), text: 'System initialized. Hacking module loaded.' }
  ]);

  const addLog = (text) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), text }, ...prev]);
  };

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcode === 'hacker123' || passcode === '1337') {
      setIsConsoleUnlocked(true);
      sessionStorage.setItem('attacker_unlocked', 'true');
      setPasscodeError('');
    } else {
      setPasscodeError('ACCESS DENIED: INVALID PASSCODE');
    }
  };

  const fetchDevices = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await http.get('/attacks/devices');
      if (Array.isArray(res)) {
        setDevices(res);
        
        // Sync active attacks: if any device is now isolated, remove it from active attacks
        setActiveAttacks((prev) => {
          const updated = { ...prev };
          let changed = false;
          res.forEach(dev => {
            if (dev.status === 'isolated' && updated[dev._id]) {
              delete updated[dev._id];
              changed = true;
            }
          });
          return changed ? updated : prev;
        });

        const currentSelected = selectedDeviceRef.current;
        if (res.length > 0 && !currentSelected) {
          setSelectedDevice(res[0]);
        } else if (currentSelected) {
          const updatedSelected = res.find(d => d._id === currentSelected._id);
          if (updatedSelected) {
            setSelectedDevice(updatedSelected);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      if (!isSilent) addLog('Error: Failed to fetch target devices.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleLaunchAttack = async () => {
    if (!selectedDevice) {
      alert('Vui lòng chọn một thiết bị mục tiêu!');
      return;
    }

    const isCurrentAttackActive = !!activeAttacks[selectedDevice._id];
    const targetAttackType = isCurrentAttackActive ? 'stop' : attackType;

    try {
      setActionLoading(true);
      if (isCurrentAttackActive) {
        addLog(`Stopping active attack on ${selectedDevice._id}...`);
      } else {
        addLog(`Sending attack command (${attackType.toUpperCase()}) to backend for ${selectedDevice._id}...`);
      }
      
      const payload = {
        device_id: selectedDevice._id,
        attack_type: targetAttackType
      };

      const res = await http.post('/attacks/launch', payload);
      
      if (res && res.status === 'success') {
        if (isCurrentAttackActive) {
          addLog(`Device ${selectedDevice._id} attack successfully stopped.`);
          setActiveAttacks((prev) => {
            const updated = { ...prev };
            delete updated[selectedDevice._id];
            return updated;
          });
        } else {
          addLog(`SUCCESS: ${attackType.toUpperCase()} attack successfully injected into ${selectedDevice._id}.`);
          setActiveAttacks((prev) => ({
            ...prev,
            [selectedDevice._id]: attackType
          }));
        }
      } else {
        addLog(`FAILED: Server rejected the command.`);
      }
    } catch (error) {
      console.error('Error launching attack:', error);
      addLog(`ERROR: Network timeout or server exception.`);
    } finally {
      setActionLoading(false);
      fetchDevices(); // Refresh list to see updated status
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(() => {
      fetchDevices(true);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!isConsoleUnlocked) {
    return (
      <div className="attacker-lock-screen">
        <div className="lock-card">
          <AlertOctagon size={48} className="lock-icon neon-blink-red" />
          <h1 className="lock-title">ACCESS RESTRICTED</h1>
          <p className="lock-subtitle">RED-TEAM SIMULATOR INTRUSION PROTOCOL</p>
          
          <form onSubmit={handlePasscodeSubmit} className="lock-form">
            <div className="input-group">
              <label htmlFor="passcode">ENTER DECRYPTION KEY</label>
              <input
                id="passcode"
                type="password"
                placeholder="••••••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
              />
            </div>
            
            {passcodeError && <div className="error-message">{passcodeError}</div>}
            
            <button type="submit" className="unlock-btn">
              <span>INITIALIZE SHELL</span>
            </button>
          </form>
          
          <div className="lock-footer">
            <span>SECURE ENCRYPTED NODE</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="attacker-console-container">
      {/* Red Cyberpunk Header */}
      <div className="console-header">
        <div className="branding">
          <AlertOctagon size={24} className="neon-blink-red" />
          <h1>ICS-GUARD INTRUSION & ATTACK SIMULATOR</h1>
        </div>
        <div className="status-badge">
          <span className="dot"></span>
          <span>CONSOLE ACTIVE [RED-TEAM]</span>
        </div>
      </div>

      <div className="console-body">
        {/* Left Panel: Target Device Map */}
        <div className="left-panel">
          <div className="panel-title">
            <h2>Thiết Bị Mục Tiêu (Target Map)</h2>
            <button className="refresh-btn" onClick={fetchDevices} disabled={loading}>
              <RotateCcw size={14} />
              <span>Làm mới</span>
            </button>
          </div>

          {loading && devices.length === 0 ? (
            <div className="loading-state">Đang dò quét sơ đồ mạng...</div>
          ) : (
            <div className="device-grid">
              {devices.map((device) => {
                const isSelected = selectedDevice && selectedDevice._id === device._id;
                const isDeviceUnderAttack = !!activeAttacks[device._id];
                const statusClass = device.status === 'isolated'
                  ? 'isolated'
                  : (isDeviceUnderAttack
                      ? 'under-attack'
                      : (device.status === 'offline' ? 'offline' : 'active'));
                
                return (
                  <div
                    key={device._id}
                    className={`device-square ${statusClass} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedDevice(device);
                      addLog(`Target selected: ${device._id} [${device.type}]`);
                    }}
                    title={`${device._id} - ${device.type} (${device.status})`}
                  >
                    <div className="square-label">{device._id.split('-').pop()}</div>
                    <div className="status-indicator"></div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="grid-legend">
            <div className="legend-item">
              <span className="dot active"></span>
              <span>Online (Normal)</span>
            </div>
            <div className="legend-item">
              <span className="dot isolated"></span>
              <span>Isolated (SOC Blocked)</span>
            </div>
            <div className="legend-item">
              <span className="dot under-attack"></span>
              <span>Under Attack (Red)</span>
            </div>
            <div className="legend-item">
              <span className="dot offline"></span>
              <span>Offline / Down</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Attack Injection Tools */}
        <div className="right-panel">
          <div className="control-card">
            <h2>Cấu Hình Tấn Công (Attack Configuration)</h2>
            
            {selectedDevice ? (
              <div className="target-summary">
                <div className="summary-row">
                  <span className="label">Mục tiêu:</span>
                  <span className="value text-red">{selectedDevice._id}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Loại:</span>
                  <span className="value">{selectedDevice.type}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Phân vùng:</span>
                  <span className="value">{selectedDevice.zone}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Trạng thái:</span>
                  <span className="value capitalize">{selectedDevice.status}</span>
                </div>
              </div>
            ) : (
              <div className="no-target">Chưa chọn thiết bị mục tiêu</div>
            )}

            <div className="attack-selection-area">
              <label>Kịch bản tấn công (Scenario)</label>
              <div className="scenario-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scenario"
                    value="traffic_spike"
                    checked={attackType === 'traffic_spike'}
                    onChange={() => setAttackType('traffic_spike')}
                  />
                  <div className="option-desc">
                    <span className="title">DDoS Traffic Spike</span>
                    <span className="sub">Tạo lưu lượng gói tin đột biến vượt ngưỡng 50 KB/s</span>
                  </div>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="scenario"
                    value="brute_force"
                    checked={attackType === 'brute_force'}
                    onChange={() => setAttackType('brute_force')}
                  />
                  <div className="option-desc">
                    <span className="title">SSH Brute Force Attack</span>
                    <span className="sub">Bắn chùm 12 log đăng nhập thất bại từ IP ngoài</span>
                  </div>
                </label>
              </div>
            </div>

            <button
              className={`fire-btn ${activeAttacks[selectedDevice?._id] ? 'stop' : 'launch'}`}
              onClick={handleLaunchAttack}
              disabled={actionLoading || !selectedDevice}
            >
              {actionLoading ? (
                <span>Đang truyền payload...</span>
              ) : activeAttacks[selectedDevice?._id] ? (
                <>
                  <Link2 size={18} />
                  <span>DỪNG CUỘC TẤN CÔNG [STOP]</span>
                </>
              ) : (
                <>
                  <Play size={18} />
                  <span>KÍCH HOẠT TẤN CÔNG [LAUNCH]</span>
                </>
              )}
            </button>
          </div>

          {/* Terminal Logs */}
          <div className="terminal-logs-card">
            <h2>
              <Terminal size={14} />
              <span>Hacker Shell Logs</span>
            </h2>
            <div className="logs-terminal">
              {logs.map((log, idx) => (
                <div key={idx} className="log-line">
                  <span className="log-time">[{log.time}]</span>
                  <span className="log-text">{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttackerConsole;
