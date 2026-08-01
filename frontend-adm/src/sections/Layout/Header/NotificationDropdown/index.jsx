import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, AlertTriangle, Info } from 'lucide-react';
import VNoData from '@/components/VNoData';
import './style.scss';

const NotificationDropdown = memo(({ 
  notifications, 
  unreadCount, 
  onMarkRead, 
  onMarkAllRead, 
  isOpen, 
  onClose 
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleViewAll = () => {
    onClose();
    navigate('/audit-management'); 
  };

  const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return t('notifications.timeAgo.seconds', { count: diffInSeconds, defaultValue: `${diffInSeconds}s ago` });
    if (diffInSeconds < 3600) return t('notifications.timeAgo.minutes', { count: Math.floor(diffInSeconds / 60), defaultValue: `${Math.floor(diffInSeconds / 60)}m ago` });
    if (diffInSeconds < 86400) return t('notifications.timeAgo.hours', { count: Math.floor(diffInSeconds / 3600), defaultValue: `${Math.floor(diffInSeconds / 3600)}h ago` });
    return t('notifications.timeAgo.days', { count: Math.floor(diffInSeconds / 86400), defaultValue: `${Math.floor(diffInSeconds / 86400)}d ago` });
  };

  const getIcon = (severity) => {
    if (severity === 'warning' || severity === 'error') {
      return <AlertTriangle size={24} style={{ color: '#ff4d4f' }} />;
    }
    if (severity === 'info') {
      return <Info size={24} style={{ color: '#1890ff' }} />;
    }
    return <Activity size={24} style={{ color: '#52c41a' }} />;
  };

  return (
    <div className="notification-dropdown">
      <div className="notification-header">
        <h3>{t('notifications.title', { defaultValue: 'System Logs' })}</h3>
        {unreadCount > 0 && (
          <button className="mark-all-btn" onClick={onMarkAllRead}>
            {t('notifications.markAllAsRead', { defaultValue: 'Mark all as read' })}
          </button>
        )}
      </div>
      
      <div className="notification-list">
        {notifications.length === 0 ? (
          <VNoData message={t('notifications.noNewNotifications', { defaultValue: 'No new logs' })} />
        ) : (
          notifications.map(notification => (
            <div 
              key={notification._id} 
              className={`notification-item ${!notification.isRead ? 'unread' : 'read'}`}
              onClick={() => {
                if (!notification.isRead && onMarkRead) onMarkRead(notification._id);
              }}
            >
              <div className="notification-icon">
                {getIcon(notification.severity)}
              </div>
              <div className="notification-content">
                <div className="notification-title">
                  <span className="alert-title">
                    {notification.title}
                  </span>
                </div>
                <div className="notification-message">
                  {notification.message}
                </div>
                <div className="notification-meta">
                  <span className="device-name">{notification.username || 'System'}</span>
                  <span className="time-ago">
                    {!notification.isRead && <span className="unread-dot" />}
                    {timeAgo(notification.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="notification-footer">
        <a href="#" onClick={(e) => {
          e.preventDefault();
          handleViewAll();
        }}>
          {t('notifications.viewAll', { defaultValue: 'View All Activity' })}
        </a>
      </div>
    </div>
  );
});

NotificationDropdown.displayName = 'NotificationDropdown';

export default NotificationDropdown;
