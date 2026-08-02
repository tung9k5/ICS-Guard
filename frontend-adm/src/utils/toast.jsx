import React from 'react';
import { toast as toastify } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import i18n from '@/i18n/config';

const defaultOptions = {
  position: "top-right",
  style: { 
    width: '26.7857rem', 
    wordBreak: 'break-word', 
    marginBottom: '0.8571rem'
  },
  icon: false
};

export const toast = {
  success: (message) => {
    toastify.success(
      <div style={{ padding: '0 0.2857rem' }}>
        <strong style={{ fontSize: '1.0714rem', display: 'block', marginBottom: '0.4286rem' }}>{i18n.t('common.toast_success_title')}</strong>
        <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>{message}</div>
      </div>,
      { ...defaultOptions, autoClose: 3000 }
    );
  },
  error: (message) => {
    toastify.error(
      <div style={{ padding: '0 0.2857rem' }}>
        <strong style={{ fontSize: '1.0714rem', display: 'block', marginBottom: '0.4286rem' }}>{i18n.t('common.toast_error_title')}</strong>
        <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>{message}</div>
      </div>,
      { ...defaultOptions, autoClose: 4000 }
    );
  },
  info: (message) => {
    toastify.info(
      <div style={{ padding: '0 0.2857rem' }}>
        <strong style={{ fontSize: '1.0714rem', display: 'block', marginBottom: '0.4286rem' }}>{i18n.t('common.toast_info_title')}</strong>
        <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>{message}</div>
      </div>,
      { ...defaultOptions, autoClose: 3000 }
    );
  }
};
