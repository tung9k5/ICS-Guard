import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import VInput from '@/components/VInput';
import VButton from '@/components/VButton';
import VDialog from '@/components/VDialog';
import { RULE_SEVERITIES } from '@/constants/ruleConstants';

const RuleForm = ({ initialData, onSubmit, onCancel, loading }) => {
  const { t } = useTranslation();
  const isEdit = !!initialData;
  const [formData, setFormData] = useState({
    rule_name: '',
    description: '',
    severity: 'MEDIUM',
    time_window_seconds: 60,
    trigger_count: 5,
    is_active: true,
    conditions: '[]',
    actions: '[]'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        conditions: JSON.stringify(initialData.conditions || [], null, 2),
        actions: JSON.stringify(initialData.actions || [], null, 2)
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        time_window_seconds: Number(formData.time_window_seconds),
        trigger_count: Number(formData.trigger_count),
        conditions: JSON.parse(formData.conditions),
        actions: JSON.parse(formData.actions)
      };
      onSubmit(payload);
    } catch (err) {
      setError(t('rules.json_error', 'Lỗi cú pháp JSON. Vui lòng kiểm tra Conditions và Actions.'));
    }
  };

  return (
    <VDialog
      visible={true}
      onHide={onCancel}
      header={isEdit ? t('rules.edit', 'Sửa quy tắc') : t('rules.add', 'Thêm quy tắc mới')}
      style={{ maxWidth: '800px' }}
    >
      <form className="rule-form" onSubmit={handleSubmit}>
        {error && <div className="alert-error mb-4" style={{ color: 'var(--red-500)' }}>{error}</div>}
        
        <div className="form-row form-row-2">
          <VInput
            label={t('rules.rule_name', 'Tên Quy tắc')}
            name="rule_name"
            value={formData.rule_name}
            onChange={handleChange}
            required
          />
          <VInput
            label={t('rules.description', 'Mô tả')}
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
        </div>

        <div className="form-row form-row-2">
          <div className="v-input-wrapper mb-0">
            <label className="v-label">
              {t('rules.severity', 'Mức độ')}
              <span style={{ color: 'var(--red-500)', marginLeft: '4px' }}>*</span>
            </label>
            <select 
              name="severity" 
              value={formData.severity} 
              onChange={handleChange} 
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)' }}
            >
              {RULE_SEVERITIES.map(sev => (
                <option key={sev.value} value={sev.value}>{sev.label}</option>
              ))}
            </select>
          </div>
          
          <div className="v-input-wrapper mb-0">
            <label className="v-label">
              {t('rules.status', 'Trạng thái')}
              <span style={{ color: 'var(--red-500)', marginLeft: '4px' }}>*</span>
            </label>
            <select 
              name="is_active" 
              value={formData.is_active} 
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)' }}
            >
              <option value="true">{t('rules.status_active', 'Đang hoạt động')}</option>
              <option value="false">{t('rules.status_inactive', 'Tạm dừng')}</option>
            </select>
          </div>
        </div>

        <div className="form-row form-row-2">
          <VInput
            label={t('rules.time_window', 'Thời gian (s)')}
            name="time_window_seconds"
            type="number"
            value={formData.time_window_seconds}
            onChange={handleChange}
            required
          />
          <VInput
            label={t('rules.trigger_count', 'Ngưỡng')}
            name="trigger_count"
            type="number"
            value={formData.trigger_count}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row form-row-2">
          <div className="v-input-wrapper mb-0">
            <label className="v-label">{t('rules.conditions', 'Điều kiện (JSON)')}</label>
            <textarea
              name="conditions"
              value={formData.conditions}
              onChange={handleChange}
              className="v-input"
              rows="5"
              required
              style={{ fontFamily: 'monospace', width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)', resize: 'vertical' }}
            />
          </div>
          <div className="v-input-wrapper mb-0">
            <label className="v-label">{t('rules.actions', 'Hành động (JSON)')}</label>
            <textarea
              name="actions"
              value={formData.actions}
              onChange={handleChange}
              className="v-input"
              rows="5"
              style={{ fontFamily: 'monospace', width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <VButton type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel', 'Hủy bỏ')}
          </VButton>
          <VButton type="submit" variant="primary" loading={loading}>
            <Save size={18} />
            {isEdit ? t('common.update', 'Cập nhật') : t('common.save', 'Lưu lại')}
          </VButton>
        </div>
      </form>
    </VDialog>
  );
};

export default RuleForm;
