import { useState, useEffect, useCallback, useRef } from 'react';
import * as notificationApi from '../api/notifications';
import { NOTIFICATION_POLLING_INTERVAL } from '../constants/notificationConstants';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isTabVisible = useRef(true);
  const debounceTimer = useRef(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisible.current = document.visibilityState === 'visible';
      if (isTabVisible.current) {
        loadNotifications(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [notifsRes, countRes] = await Promise.all([
        notificationApi.getNotifications({ limit: 10 }),
        notificationApi.getUnreadCount()
      ]);
      // Axios interceptor returns response.data directly.
      setNotifications(notifsRes.data?.data || []);
      setUnreadCount(countRes.data?.count || 0);
      setError(null);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Polling logic
  // 5 seconds interval was chosen for near real-time updates. 
  // If >5000 devices exist, recommend migrating to SSE or WebSockets to reduce server load.
  useEffect(() => {
    loadNotifications();

    const intervalId = setInterval(() => {
      if (isTabVisible.current) {
        loadNotifications(true);
      }
    }, NOTIFICATION_POLLING_INTERVAL);

    return () => clearInterval(intervalId); // cleanup interval on unmount
  }, [loadNotifications]);

  const markRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      
      // Debounce refresh if user rapidly marks multiple read
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        loadNotifications(true);
      }, 500);
      
      // Optimistic update
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
    refresh: loadNotifications
  };
};
