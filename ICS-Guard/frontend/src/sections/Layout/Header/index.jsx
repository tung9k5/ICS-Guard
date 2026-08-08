import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, User, Menu, CheckCircle2, AlertTriangle, X, ShieldAlert, Check, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { socket } from '@/services/socket';
import { toast as toastify } from 'react-toastify';
import './Header.scss';

const Header = ({ toggleSidebar, user, onUpdateUser, onOpenProfile }) => {
  const { t } = useTranslation();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'alert' | 'success'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const popoverRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initial notification history
  const [notifications, setNotifications] = useState([
    {
      id: 'n-1',
      title: 'Hệ thống hoạt động ổn định',
      message: 'Toàn bộ thiết bị OT và phân vùng mạng đang ở trạng thái an toàn.',
      type: 'success',
      read: false,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    }
  ]);

  // Play alert beep using Web Audio API (no external file needed)
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      // Create 3 short beeps
      [0, 0.18, 0.36].forEach((startOffset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime + startOffset);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + 0.15);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + 0.15);
      });
    } catch (e) {
      // Ignore audio errors (user hasn't interacted yet)
    }
  }, [soundEnabled]);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show browser push notification
  const showBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`⚠️ ICS-Guard: ${title}`, {
          body,
          icon: '/vite.svg',
          tag: 'ics-alert',
          requireInteraction: true,
        });
      } catch (e) {}
    }
  }, []);

  // Handle socket real-time events
  useEffect(() => {
    if (!socket) return;

    // Handler for security alerts — listens to ALL event names the backend may emit
    const handleAlert = (data) => {
      const title = data?.title || 'Cảnh Báo An Ninh Khẩn Cấp';
      const message = data?.description || data?.message || 'Hệ thống vừa ghi nhận sự cố bất thường trên đường truyền OT.';
      const severity = String(data?.severity || 'HIGH').toUpperCase();
      const deviceId = data?.device_id || data?.device_name || '';

      // Add to notification bell
      setNotifications(prev => [{
        id: `alert-${Date.now()}-${Math.random()}`,
        title,
        message: deviceId ? `[${deviceId}] ${message}` : message,
        type: 'danger',
        read: false,
        timestamp: new Date().toISOString()
      }, ...prev.slice(0, 49)]); // max 50 notifications

      // Toast popup (cảnh báo nổi trên màn hình)
      toastify.error(
        <div style={{ padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>⚔️</span>
            <strong style={{ fontSize: '14px', color: '#fff' }}>TẤN CÔNG PHÁT HIỆN — {severity}</strong>
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#fca5a5' }}>{title}</div>
          {deviceId && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Thiết bị: {deviceId}</div>}
        </div>,
        {
          position: 'top-right',
          autoClose: 8000,
          hideProgressBar: false,
          style: { background: '#1e0a0a', border: '1px solid #7f1d1d', borderRadius: '10px', width: '380px' },
          icon: false,
        }
      );

      // Browser push notification
      showBrowserNotification(title, `${severity} — ${message}`);

      // Alert sound
      playAlertSound();
    };

    // Handler for new incidents
    const handleIncident = (data) => {
      const title = data?.title || 'Sự Cố An Ninh Mới';
      const severity = String(data?.severity || 'HIGH').toUpperCase();

      setNotifications(prev => [{
        id: `inc-${Date.now()}-${Math.random()}`,
        title: `[SỰ CỐ] ${title}`,
        message: data?.description || 'Một sự cố an ninh mới đã được tạo và cần xử lý.',
        type: 'danger',
        read: false,
        timestamp: new Date().toISOString()
      }, ...prev.slice(0, 49)]);

      toastify.error(
        <div style={{ padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>🚨</span>
            <strong style={{ fontSize: '14px', color: '#fff' }}>SỰ CỐ MỚI — {severity}</strong>
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#fca5a5' }}>{title}</div>
        </div>,
        {
          position: 'top-right',
          autoClose: 10000,
          style: { background: '#1a0e1a', border: '1px solid #6b21a8', borderRadius: '10px', width: '380px' },
          icon: false,
        }
      );

      showBrowserNotification(`SỰ CỐ: ${title}`, `Mức độ: ${severity}`);
      playAlertSound();
    };

    const handleUserSync = (data) => {
      if (data?.action === 'update' || data?.action === 'create') {
        setNotifications(prev => [{
          id: `user-${Date.now()}`,
          title: 'Cập nhật tài khoản hệ thống',
          message: `Tài khoản ${data?.user?.username || ''} đã được cập nhật.`,
          type: 'success',
          read: false,
          timestamp: new Date().toISOString()
        }, ...prev.slice(0, 49)]);
      }
    };

    // Listen to ALL possible event names the backend may use
    socket.on('NEW_ALERT', handleAlert);
    socket.on('ALERT_CREATED', handleAlert);
    socket.on('ALERT_TRIGGERED', handleAlert);    // legacy name
    socket.on('NEW_INCIDENT', handleIncident);
    socket.on('INCIDENT_CREATED', handleIncident);
    socket.on('USER_SYNC', handleUserSync);

    return () => {
      socket.off('NEW_ALERT', handleAlert);
      socket.off('ALERT_CREATED', handleAlert);
      socket.off('ALERT_TRIGGERED', handleAlert);
      socket.off('NEW_INCIDENT', handleIncident);
      socket.off('INCIDENT_CREATED', handleIncident);
      socket.off('USER_SYNC', handleUserSync);
    };
  }, [playAlertSound, showBrowserNotification]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasDangerAlert = notifications.some(n => !n.read && (n.type === 'danger' || n.type === 'warning'));

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAllNotifs = () => {
    setNotifications([]);
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeTab === 'alert') return n.type === 'danger' || n.type === 'warning';
    if (activeTab === 'success') return n.type === 'success' || n.type === 'info';
    return true;
  });

  const getGreetingName = () => {
    if (user?.full_name && user.full_name.trim() !== '') return user.full_name;
    if (user?.username) return user.username;
    
    // Check cached session
    try {
      const cached = sessionStorage.getItem('cached_user');
      if (cached) {
        const obj = JSON.parse(cached);
        if (obj.full_name) return obj.full_name;
        if (obj.username) return obj.username;
      }
    } catch (e) {}

    return 'SOC Administrator';
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="toggle-sidebar-btn" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="header-titles">
          <h2>Xin chào, {getGreetingName()}!</h2>
          <p>{t('layout.header.subtitle', 'Hệ thống giám sát và bảo vệ hạ tầng điều khiển công nghiệp (ICS Guard)')}</p>
        </div>
      </div>

      <div className="header-right">
        <LanguageSwitcher />

        {/* Bell Notification Area */}
        <div style={{ position: 'relative' }} ref={popoverRef}>
          <button 
            className="notification-btn" 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            title="Thông báo hệ thống"
            style={{ position: 'relative' }}
          >
            <Bell size={20} style={hasDangerAlert ? { animation: 'bellShake 0.6s ease infinite', color: '#f87171' } : {}} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#ef4444', color: '#fff',
                fontSize: '10px', fontWeight: 700,
                minWidth: '16px', height: '16px',
                borderRadius: '8px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', lineHeight: 1,
                boxShadow: '0 0 0 2px #0f172a',
                animation: 'pulse 1.5s ease infinite'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Popover Dropdown */}
          {isNotifOpen && (
            <div className="notification-popover">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} style={{ color: '#38bdf8' }} />
                  <strong style={{ color: '#f8fafc', fontSize: '14px' }}>Thông Báo Hệ Thống</strong>
                  {unreadCount > 0 && (
                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px' }}>
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={() => setSoundEnabled(v => !v)}
                    title={soundEnabled ? 'Tắt âm thanh cảnh báo' : 'Bật âm thanh cảnh báo'}
                    style={{ background: 'none', border: 'none', color: soundEnabled ? '#38bdf8' : '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  >
                    {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </button>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Đánh dấu tất cả là đã đọc"
                    >
                      <Check size={14} /> Đã đọc
                    </button>
                  )}
                  <button 
                    onClick={() => setIsNotifOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#090d16' }}>
                <button 
                  onClick={() => setActiveTab('all')} 
                  style={{ flex: 1, padding: '8px 0', border: 'none', background: 'none', borderBottom: activeTab === 'all' ? '2px solid #38bdf8' : 'none', color: activeTab === 'all' ? '#38bdf8' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Tất cả ({notifications.length})
                </button>
                <button 
                  onClick={() => setActiveTab('alert')} 
                  style={{ flex: 1, padding: '8px 0', border: 'none', background: 'none', borderBottom: activeTab === 'alert' ? '2px solid #ef4444' : 'none', color: activeTab === 'alert' ? '#ef4444' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cảnh báo ({notifications.filter(n => n.type === 'danger' || n.type === 'warning').length})
                </button>
                <button 
                  onClick={() => setActiveTab('success')} 
                  style={{ flex: 1, padding: '8px 0', border: 'none', background: 'none', borderBottom: activeTab === 'success' ? '2px solid #10b981' : 'none', color: activeTab === 'success' ? '#10b981' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Thành công ({notifications.filter(n => n.type === 'success' || n.type === 'info').length})
                </button>
              </div>

              {/* Notification List Body */}
              <div style={{ overflowY: 'auto', flex: 1, maxHeight: '340px' }}>
                {filteredNotifs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b', fontSize: '13px' }}>
                    Không có thông báo nào trong danh mục này.
                  </div>
                ) : (
                  filteredNotifs.map(n => (
                    <div 
                      key={n.id}
                      onClick={() => setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #1e293b',
                        background: n.read ? 'transparent' : 'rgba(56, 189, 248, 0.04)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '12px',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: '2px' }}>
                        {n.type === 'danger' && <ShieldAlert size={18} style={{ color: '#ef4444' }} />}
                        {n.type === 'warning' && <AlertTriangle size={18} style={{ color: '#f59e0b' }} />}
                        {(n.type === 'success' || n.type === 'info') && <CheckCircle2 size={18} style={{ color: '#10b981' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: n.read ? '#cbd5e1' : '#fff' }}>{n.title}</span>
                          {!n.read && <span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%' }}></span>}
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{n.message}</p>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              {notifications.length > 0 && (
                <div style={{ padding: '8px 16px', background: '#090d16', borderTop: '1px solid #1e293b', textAlign: 'center' }}>
                  <button 
                    onClick={clearAllNotifs}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Xóa tất cả lịch sử thông báo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="user-profile" onClick={onOpenProfile} style={{ cursor: 'pointer' }}>
          {user?.avatar ? (
            <img src={user.avatar} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <User size={16} />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
