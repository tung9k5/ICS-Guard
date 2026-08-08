import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Menu, CheckCircle2, AlertTriangle, X, ShieldAlert, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { socket } from '@/services/socket';
import './Header.scss';

const Header = ({ toggleSidebar, user, onUpdateUser, onOpenProfile }) => {
  const { t } = useTranslation();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'alert' | 'success'
  const popoverRef = useRef(null);

  // Initial notification history
  const [notifications, setNotifications] = useState([
    {
      id: 'n-1',
      title: 'Hệ thống hoạt động ổn định',
      message: 'Toàn bộ 12 thiết bị OT và phân vùng mạng đang ở trạng thái an toàn.',
      type: 'success',
      read: false,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: 'n-2',
      title: 'Cảnh báo vi phạm giao thức Modbus',
      message: 'Phát hiện câu lệnh Force Coil (FC05) không hợp lệ gửi tới PLC-Water-01 từ IP 192.168.10.100.',
      type: 'warning',
      read: false,
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
    },
    {
      id: 'n-3',
      title: 'Xác thực tài khoản thành công',
      message: 'Phiên làm việc bảo mật đã được kích hoạt thành công.',
      type: 'info',
      read: true,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
  ]);

  // Handle socket real-time events
  useEffect(() => {
    if (!socket) return;

    const handleAlert = (data) => {
      const newNotif = {
        id: `socket-alert-${Date.now()}`,
        title: data?.title || 'Phát hiện Cảnh Báo An Ninh Khẩn Cấp',
        message: data?.description || data?.message || 'Hệ thống vừa ghi nhận sự cố bất thường trên đường truyền OT.',
        type: 'danger',
        read: false,
        timestamp: new Date().toISOString()
      };
      setNotifications(prev => [newNotif, ...prev]);
    };

    const handleUserSync = (data) => {
      if (data?.action === 'update' || data?.action === 'create') {
        const newNotif = {
          id: `socket-user-${Date.now()}`,
          title: 'Cập nhật tài khoản hệ thống',
          message: `Tài khoản ${data?.user?.username || ''} đã được cập nhật trạng thái thành công.`,
          type: 'success',
          read: false,
          timestamp: new Date().toISOString()
        };
        setNotifications(prev => [newNotif, ...prev]);
      }
    };

    socket.on('ALERT_TRIGGERED', handleAlert);
    socket.on('USER_SYNC', handleUserSync);

    return () => {
      socket.off('ALERT_TRIGGERED', handleAlert);
      socket.off('USER_SYNC', handleUserSync);
    };
  }, []);

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
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="notification-dot"></span>}
          </button>

          {/* Notification Popover Dropdown */}
          {isNotifOpen && (
            <div 
              style={{
                position: 'absolute',
                top: '46px',
                right: '0',
                width: '360px',
                maxHeight: '480px',
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
                zIndex: 999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Dropdown Header */}
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
                <div style={{ display: 'flex', gap: '8px' }}>
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
