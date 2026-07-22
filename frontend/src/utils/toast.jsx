import React from 'react';
import { toast as toastify } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import i18n from '@/i18n/config';

const defaultOptions = {
  position: "top-right",
  style: { 
    width: '375px', 
    wordBreak: 'break-word', 
    marginBottom: '12px'
  },
  icon: false
};

export const toast = {
  success: (message) => {
    toastify.success(
      <div style={{ padding: '0 4px' }}>
        <strong style={{ fontSize: '15px', display: 'block', marginBottom: '6px' }}>{i18n.t('common.toast_success_title')}</strong>
        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>{message}</div>
      </div>,
      { ...defaultOptions, autoClose: 3000 }
    );
  },
  error: (message) => {
    toastify.error(
      <div style={{ padding: '0 4px' }}>
        <strong style={{ fontSize: '15px', display: 'block', marginBottom: '6px' }}>{i18n.t('common.toast_error_title')}</strong>
        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>{message}</div>
      </div>,
      { ...defaultOptions, autoClose: 4000 }
    );
  },
  info: (message) => {
    toastify.info(
      <div style={{ padding: '0 4px' }}>
        <strong style={{ fontSize: '15px', display: 'block', marginBottom: '6px' }}>{i18n.t('common.toast_info_title')}</strong>
        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>{message}</div>
      </div>,
      { ...defaultOptions, autoClose: 3000 }
    );
  }
};
