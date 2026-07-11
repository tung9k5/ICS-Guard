import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authApi from '@/api/auth';
import VButton from '@/components/VButton';
import { useTranslation } from 'react-i18next';
import { IDLE_TIMEOUT_MS, COUNTDOWN_SECONDS } from '@/constants/idleTimeoutConstants';
import VDialog from '@/components/VDialog';

const IdleTimeout = () => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const showDialogRef = useRef(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  // Fast check if user is logged in
  const isLoggedIn = !!localStorage.getItem('access_token') || !!localStorage.getItem('attacker_access_token');

  const updateShowDialog = (value) => {
    setShowDialog(value);
    showDialogRef.current = value;
  };

  const resetTimer = () => {
    if (showDialogRef.current) return; // Don't reset if dialog is already open
    
    clearTimeout(timerRef.current);
    if (!isAuthPage && isLoggedIn) {
      timerRef.current = setTimeout(() => {
        updateShowDialog(true);
        setCountdown(COUNTDOWN_SECONDS);
      }, IDLE_TIMEOUT_MS);
    }
  };

  // Reset everything when changing routes
  useEffect(() => {
    updateShowDialog(false);
    clearTimeout(timerRef.current);
    clearInterval(countdownIntervalRef.current);
    resetTimer();
  }, [location.pathname]);

  useEffect(() => {
    // Only track activity if logged in and not on auth pages
    if (isAuthPage || !isLoggedIn) {
      clearTimeout(timerRef.current);
      clearInterval(countdownIntervalRef.current);
      updateShowDialog(false);
      return;
    }

    // Initial setup
    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => resetTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause timers if user switches tabs
        clearTimeout(timerRef.current);
        clearInterval(countdownIntervalRef.current);
      } else {
        // User came back to the tab
        if (showDialogRef.current) {
          // Resume countdown
          countdownIntervalRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                handleLogout();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          // Reset idle timer
          resetTimer();
        }
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timerRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, [isAuthPage, isLoggedIn, showDialog]);

  useEffect(() => {
    if (showDialog) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownIntervalRef.current);
    }

    return () => clearInterval(countdownIntervalRef.current);
  }, [showDialog]);

  const handleContinue = () => {
    updateShowDialog(false);
    resetTimer();
  };

  const handleLogout = async () => {
    clearInterval(countdownIntervalRef.current);
    updateShowDialog(false);
    
    try {
      const isAttacker = location.pathname.startsWith('/attacker');
      const refreshTokenKey = isAttacker ? 'attacker_refresh_token' : 'refresh_token';
      const refreshToken = localStorage.getItem(refreshTokenKey);

      if (refreshToken) {
        await authApi.logout({ refreshToken });
      }
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('attacker_access_token');
      localStorage.removeItem('attacker_refresh_token');
      navigate('/login', { replace: true });
    }
  };

  return (
    <VDialog
      visible={showDialog}
      onHide={() => {}}
      header={t('common.idle_timeout.title', 'Bạn còn ở đó không?')}
      style={{ maxWidth: '400px' }}
      closeOnEscape={false}
      closable={false}
    >
      <div style={{ textAlign: 'center', padding: '10px 0 20px 0' }}>
        <p style={{ margin: 0, color: 'var(--slate-700)', fontSize: '15px', lineHeight: '1.5' }}>
          {t('common.idle_timeout.description_1', 'Phiên đăng nhập sẽ tự động đăng xuất sau ')}
          <strong>{countdown}</strong>
          {t('common.idle_timeout.description_2', ' giây nữa do không có hoạt động.')}
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <VButton variant="primary" onClick={handleContinue} style={{ minWidth: '150px' }}>
          {t('common.idle_timeout.continue', 'Tiếp tục sử dụng')}
        </VButton>
      </div>
    </VDialog>
  );
};


export default IdleTimeout;
