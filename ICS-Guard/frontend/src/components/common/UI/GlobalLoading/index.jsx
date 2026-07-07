import React, { useState, useEffect, useRef } from 'react';
import { Shield, Server, Activity } from 'lucide-react';
import { loadingEvent } from '@/utils/loadingEvent';
import './GlobalLoading.scss';

const GlobalLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [iconIndex, setIconIndex] = useState(0);
  const startTimeRef = useRef(0);
  const hideTimeoutRef = useRef(null);

  useEffect(() => {
    const handleShow = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (!isLoading) {
        startTimeRef.current = Date.now();
        setIsLoading(true);
      }
    };

    const handleHide = () => {
      const elapsedTime = Date.now() - startTimeRef.current;
      const minDuration = 1200; // Ít nhất 2 giây

      if (elapsedTime < minDuration) {
        const remainingTime = minDuration - elapsedTime;
        hideTimeoutRef.current = setTimeout(() => {
          setIsLoading(false);
        }, remainingTime);
      } else {
        setIsLoading(false);
      }
    };

    loadingEvent.addEventListener('show', handleShow);
    loadingEvent.addEventListener('hide', handleHide);

    return () => {
      loadingEvent.removeEventListener('show', handleShow);
      loadingEvent.removeEventListener('hide', handleHide);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isLoading]);

  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setIconIndex((prev) => (prev + 1) % 3);
      }, 600); // Đổi icon mỗi 600ms
    } else {
      setIconIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const icons = [
    <Shield size={48} className="loading-icon" />,
    <Server size={48} className="loading-icon" />,
    <Activity size={48} className="loading-icon" />
  ];

  return (
    <div className="global-loading-overlay">
      <div className="loading-content">
        <div className="icon-container">
          {icons[iconIndex]}
        </div>
        <p>Đang xử lý dữ liệu...</p>
      </div>
    </div>
  );
};

export default GlobalLoading;
