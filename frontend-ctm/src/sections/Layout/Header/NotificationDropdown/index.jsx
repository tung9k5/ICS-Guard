import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Network, Droplets, ShieldAlert } from 'lucide-react';
import { NOTIFICATION_SEVERITY } from '../../../../constants/notificationConstants';
import { getMappedNotification } from '../../../../utils/notificationMapper';
import { getAlertIconAndStyle } from '../../../../utils/alertMapper';
import { APP_ROUTES } from '../../../../constants/routes';
import VNoData from '../../../../components/VNoData';
import './style.scss';

// CSS classes will be styled to resemble Facebook's notification UI
// Using React.memo to prevent unnecessary re-renders when parent components update
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
    navigate(APP_ROUTES.CUSTOMER.ALERTS);
  };



  const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return t('notifications.timeAgo.seconds', { count: diffInSeconds });
    if (diffInSeconds < 3600) return t('notifications.timeAgo.minutes', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('notifications.timeAgo.hours', { count: Math.floor(diffInSeconds / 3600) });
    return t('notifications.timeAgo.days', { count: Math.floor(diffInSeconds / 86400) });
  };

  return (
    <div className="notification-dropdown">
      <div className="notification-header">
        <h3>{t('notifications.title')}</h3>
        {unreadCount > 0 && (
          <button className="mark-all-btn" onClick={onMarkAllRead}>
            {t('notifications.markAllAsRead')}
          </button>
        )}
      </div>
      
      <div className="notification-list">
        {notifications.length === 0 ? (
          <VNoData message={t('notifications.noNewNotifications')} />
        ) : (
          notifications.map(notification => {
            const { title, message, rule_name } = getMappedNotification(notification, t);
            const { icon: AlertIcon, style: iconStyle } = getAlertIconAndStyle(rule_name);
            return (
            <div 
              key={notification._id} 
              className={`notification-item ${!notification.isRead ? 'unread' : 'read'}`}
              onClick={() => {
                if (!notification.isRead) onMarkRead(notification._id);
              }}
            >
              <div className="notification-icon">
                <AlertIcon size={24} style={iconStyle} />
              </div>
              <div className="notification-content">
                <div className="notification-title">
                  <span className="alert-title">
                    {title}
                  </span>
                </div>
                <div className="notification-message">
                  {message}
                </div>
                <div className="notification-meta">
                  {notification.deviceId && <span className="device-name">{notification.deviceId.name || notification.deviceId}</span>}
                  <span className="time-ago">
                    {!notification.isRead && <span className="unread-dot" />}
                    {timeAgo(notification.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          )})
        )}
      </div>
      <div className="notification-footer">
        <a href="#" onClick={(e) => {
          e.preventDefault();
          handleViewAll();
        }}>
          {t('notifications.viewAll')}
        </a>
      </div>
    </div>
  );
});

NotificationDropdown.displayName = 'NotificationDropdown';

export default NotificationDropdown;
