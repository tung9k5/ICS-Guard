import React, { useState, useEffect, useRef } from 'react';
import { Shield, Server, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { loadingEvent } from '@/utils/loadingEvent';
import { GLOBAL_LOADING_MIN_DURATION_MS, GLOBAL_LOADING_ICON_INTERVAL_MS } from '@/constants/uiConstants';
import './GlobalLoading.scss';

const GlobalLoading = ({ forceShow = false }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(forceShow);
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
      const minDuration = GLOBAL_LOADING_MIN_DURATION_MS;

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
      }, GLOBAL_LOADING_ICON_INTERVAL_MS);
    } else {
      setIconIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const icons = [
    <img src="/loading1.png" alt="loading 1" style={{ width: 100, height: 100, objectFit: 'contain' }} />,
    <img src="/loading2.png" alt="loading 2" style={{ width: 100, height: 100, objectFit: 'contain' }} />,
    <img src="/loading3.png" alt="loading 3" style={{ width: 100, height: 100, objectFit: 'contain' }} />
  ];

  return (
    <div className="global-loading-overlay">
      <div className="loading-content">
        <div className="icon-container">
          <div className="loading-icon-wrapper" key={iconIndex}>
            {icons[iconIndex]}
          </div>
        </div>
        <p>{t('common.processing_data', 'Đang xử lý dữ liệu...')}</p>
      </div>
    </div>
  );
};

export default GlobalLoading;
