import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import VButton from '@/components/VButton';
import VDialog from '@/components/VDialog';
import ApiSimulator from '@/api/simulator';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { SCENARIOS } from '@/constants/deviceConstants';

const SimulatorModal = ({ device, onClose }) => {
  const { t } = useTranslation();
  const [scenario, setScenario] = useState('NORMAL');
  const [severity, setSeverity] = useState('HIGH');
  const [loading, setLoading] = useState(false);

  const [duration, setDuration] = useState('');

  React.useEffect(() => {
    if (device && device.current_scenario && device.current_scenario !== 'NORMAL' && device.scenario_start_time) {
      setScenario(device.current_scenario);
      
      const updateDuration = () => {
        const start = new Date(device.scenario_start_time).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 1000);
        if (diff < 0) return;
        
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        if (h > 0) {
          setDuration(t('simulator.time_format_hours', '{{h}} giờ {{m}} phút {{s}} giây', { h, m, s }));
        } else {
          setDuration(t('simulator.time_format', '{{m}} phút {{s}} giây', { m, s }));
        }
      };
      
      updateDuration();
      const interval = setInterval(updateDuration, 1000);
      return () => clearInterval(interval);
    } else {
      setScenario('NORMAL');
    }
  }, [device, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!device) return;
    
    setLoading(true);
    try {
      const id = device.id || device._id;
      await ApiSimulator.setDeviceScenario(id, scenario, severity);
      toast.success(t('simulator.success_msg', 'Đã kích hoạt kịch bản {{scenario}} cho thiết bị {{id}}', { scenario, id }));
      onClose(true); // pass true to refresh list
    } catch (error) {
      console.error(error);
      toast.error(t('simulator.error_msg', 'Gặp lỗi khi kích hoạt kịch bản'));
    } finally {
      setLoading(false);
    }
  };

  if (!device) return null;

  const header = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Activity size={20} className="text-primary" /> 
      {t('simulator.title', 'Mô phỏng IoT (Simulator)')}
    </span>
  );

  const footer = (
    <>
      <VButton variant="outline" onClick={() => onClose(false)} disabled={loading}>
        {t('common.btn_cancel', 'Đóng')}
      </VButton>
      <VButton type="submit" form="simulator-form" disabled={loading}>
        {loading ? t('simulator.sending', 'Đang gửi...') : t('simulator.apply_btn', 'Lưu kịch bản')}
      </VButton>
    </>
  );

  const currentScenarioLabel = SCENARIOS.find(s => s.value === device?.current_scenario)?.label || device?.current_scenario;

  return (
    <VDialog
      visible={!!device}
      onHide={() => onClose(false)}
      header={header}
      footer={footer}
      style={{ width: '450px', maxWidth: '100%' }}
    >
      {device.current_scenario && device.current_scenario !== 'NORMAL' && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} /> {t('simulator.running_scenario', 'Đang chạy kịch bản')}
          </h4>
          <div style={{ fontSize: '0.9rem', color: '#7f1d1d' }}>
            <div><strong>{t('simulator.type', 'Loại:')}</strong> {currentScenarioLabel}</div>
            {device.current_severity && (
              <div>
                <strong>{t('simulator.severity_label', 'Mức độ (Severity):').replace(/\s*\(.*\)/, '')}</strong>{' '}
                {t(`simulator.severity.${device.current_severity.toLowerCase()}`, device.current_severity)}
              </div>
            )}
            <div><strong>{t('simulator.start_time', 'Bắt đầu:')}</strong> {new Date(device.scenario_start_time).toLocaleString(t('common.locale', 'vi-VN'))}</div>
            <div><strong>{t('simulator.duration', 'Đã chạy:')}</strong> {duration}</div>
          </div>
        </div>
      )}

      <p style={{ marginBottom: '1rem', color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5' }}>
        {t('simulator.description', 'Chọn kịch bản mô phỏng để áp dụng lên thiết bị')} <strong style={{ color: '#111827' }}>{device.name}</strong> ({device.id || device._id}).
      </p>

      <form id="simulator-form" onSubmit={handleSubmit}>
        <div className="v-input-wrapper" style={{ marginBottom: '1.5rem' }}>
          <label className="v-label" style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
            {t('simulator.scenario_label', 'Kịch bản mới (Scenario)')}
          </label>
          <select 
            className="v-input" 
            value={scenario} 
            onChange={e => setScenario(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 2.5rem 0.75rem 1rem', 
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              color: '#1f2937',
              fontSize: '0.95rem',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" width="292.4" height="292.4"><path fill="%236b7280" d="M287 69.4a17.6 17.6 0 0 0-13-5.4H18.4c-5 0-9.3 1.8-12.9 5.4A17.6 17.6 0 0 0 0 82.2c0 5 1.8 9.3 5.4 12.9l128 127.9c3.6 3.6 7.8 5.4 12.8 5.4s9.2-1.8 12.8-5.4L287 95c3.5-3.5 5.4-7.8 5.4-12.8 0-5-1.9-9.2-5.5-12.8z"/></svg>')`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem top 50%',
              backgroundSize: '0.65rem auto',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary-color, #3b82f6)';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          >
            {SCENARIOS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="v-input-wrapper" style={{ marginBottom: '1.5rem' }}>
          <label className="v-label" style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
            {t('simulator.severity_label', 'Mức độ (Severity)')}
          </label>
          <select 
            className="v-input" 
            value={severity} 
            onChange={e => setSeverity(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 2.5rem 0.75rem 1rem', 
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              color: '#1f2937',
              fontSize: '0.95rem',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" width="292.4" height="292.4"><path fill="%236b7280" d="M287 69.4a17.6 17.6 0 0 0-13-5.4H18.4c-5 0-9.3 1.8-12.9 5.4A17.6 17.6 0 0 0 0 82.2c0 5 1.8 9.3 5.4 12.9l128 127.9c3.6 3.6 7.8 5.4 12.8 5.4s9.2-1.8 12.8-5.4L287 95c3.5-3.5 5.4-7.8 5.4-12.8 0-5-1.9-9.2-5.5-12.8z"/></svg>')`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem top 50%',
              backgroundSize: '0.65rem auto',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary-color, #3b82f6)';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          >
            <option value="LOW">{t('simulator.severity.low')}</option>
            <option value="MEDIUM">{t('simulator.severity.medium')}</option>
            <option value="HIGH">{t('simulator.severity.high')}</option>
            <option value="CRITICAL">{t('simulator.severity.critical')}</option>
          </select>
        </div>
      </form>
    </VDialog>
  );
};

export default SimulatorModal;
