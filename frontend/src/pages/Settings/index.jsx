import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import VHeaderPage from '@/components/VHeaderPage';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import VCheckbox from '@/components/VCheckbox';
import { toast } from '@/utils/toast';
import ApiSettings from '@/api/settings';
import { Save } from 'lucide-react';
import { APP_CONFIG } from '@/constants/common';
import './Settings.scss';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await ApiSettings.getAllSettings();
      // Convert array of settings to object mapping
      const settingsMap = (res.data || []).reduce((acc, curr) => {
        acc[curr.key] = curr;
        return acc;
      }, {});
      setSettings(settingsMap);
    } catch (error) {
      toast.error(t('settings.toasts.load_failed', 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value }
    }));
  };

  const handleSave = async (key) => {
    try {
      setSaving(true);
      await ApiSettings.updateSetting(key, settings[key].value);
      toast.success(t('settings.toasts.update_success', 'Updated {{key}} successfully', { key }));
    } catch (error) {
      toast.error(t('settings.toasts.update_failed', 'Failed to update {{key}}', { key }));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const promises = Object.keys(settings).map(key => 
        ApiSettings.updateSetting(key, settings[key].value)
      );
      await Promise.all(promises);
      
      // Update i18n if language changed
      if (settings['language']?.value) {
        const newLang = settings['language'].value;
        i18n.changeLanguage(newLang);
        localStorage.setItem(APP_CONFIG.LANGUAGE_KEY || 'language', newLang);
      }

      toast.success(t('settings.toasts.save_all_success', 'All settings saved successfully'));
    } catch (error) {
      toast.error(t('settings.toasts.save_all_failed', 'Failed to save some settings'));
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (key, label, type = 'text') => {
    if (!settings[key]) return null;
    
    if (type === 'checkbox') {
      return (
        <div className="setting-item checkbox-item">
          <label>{label}</label>
          <VCheckbox 
            checked={settings[key].value} 
            onChange={(e) => handleSettingChange(key, e.target.checked)} 
          />
        </div>
      );
    }

    if (type === 'select') {
      let options = [];
      if (key === 'language') {
        options = [
          { value: 'en', label: 'English' },
          { value: 'vi', label: 'Tiếng Việt' }
        ];
      } else if (key === 'timezone') {
        options = [
          { value: 'UTC', label: 'UTC' },
          { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (GMT+7)' },
          { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
          { value: 'America/New_York', label: 'America/New_York (GMT-5)' }
        ];
      }
      return (
        <div className="setting-item">
          <label>{label}</label>
          <div className="input-group">
            <select 
              className="v-input-field" 
              value={settings[key].value} 
              onChange={(e) => handleSettingChange(key, e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.7143rem',
                paddingRight: '2.5rem', 
                borderRadius: '0.5714rem', 
                border: '1px solid var(--slate-300)', 
                backgroundColor: 'var(--white)',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                backgroundSize: '1rem',
                appearance: 'none',
                cursor: 'pointer'
              }}
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    return (
      <div className="setting-item">
        <label>{label}</label>
        <div className="input-group">
          <VInput 
            type={type}
            value={settings[key].value}
            onChange={(e) => handleSettingChange(key, e.target.value)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="settings-page">
      <VHeaderPage title={t('settings.page_title', 'System Settings')} />
      
      <div className="settings-container">
        <div className="settings-sidebar">
          <button className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>{t('settings.tabs.general', 'General')}</button>
          <button className={activeTab === 'security' ? 'active' : ''} onClick={() => setActiveTab('security')}>{t('settings.tabs.security', 'Security')}</button>
          <button className={activeTab === 'notifications' ? 'active' : ''} onClick={() => setActiveTab('notifications')}>{t('settings.tabs.notifications', 'Notifications')}</button>
        </div>

        <div className="settings-content">
          {loading ? (
            <div className="loading-state">{t('settings.loading', 'Loading settings...')}</div>
          ) : (
            <div className="settings-form">
              {activeTab === 'general' && (
                <div className="settings-section animate-fade-in">
                  <h2>{t('settings.general.title', 'General Configuration')}</h2>
                  <p className="section-desc">{t('settings.general.desc', 'Manage your basic system preferences')}</p>
                  {renderInput('system_name', t('settings.fields.system_name', 'System Name'))}
                  {renderInput('timezone', t('settings.fields.timezone', 'Timezone'), 'select')}
                  {renderInput('language', t('settings.fields.language', 'Language'), 'select')}
                </div>
              )}

              {activeTab === 'security' && (
                <div className="settings-section animate-fade-in">
                  <h2>{t('settings.security.title', 'Security Policies')}</h2>
                  <p className="section-desc">{t('settings.security.desc', 'Configure password expiry, 2FA, and session timeouts')}</p>
                  {renderInput('session_timeout', t('settings.fields.session_timeout', 'Session Timeout (minutes)'), 'number')}
                  {renderInput('password_expiry', t('settings.fields.password_expiry', 'Password Expiry (days)'), 'number')}
                  {renderInput('require_2fa', t('settings.fields.require_2fa', 'Require Two-Factor Authentication'), 'checkbox')}
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="settings-section animate-fade-in">
                  <h2>{t('settings.notifications.title', 'Notifications & Integrations')}</h2>
                  <p className="section-desc">{t('settings.notifications.desc', 'Configure SMTP and Telegram endpoints for alerts')}</p>
                  {renderInput('smtp_host', t('settings.fields.smtp_host', 'SMTP Host'))}
                  {renderInput('smtp_port', t('settings.fields.smtp_port', 'SMTP Port'), 'number')}
                  {renderInput('telegram_bot_token', t('settings.fields.telegram_bot_token', 'Telegram Bot Token'))}
                </div>
              )}

              <div className="settings-actions">
                <VButton onClick={handleSaveAll} loading={saving} disabled={saving} style={{ display: 'flex', gap: '8px' }}>
                  <Save size={18} /> {t('settings.save_all', 'Save All Changes')}
                </VButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
