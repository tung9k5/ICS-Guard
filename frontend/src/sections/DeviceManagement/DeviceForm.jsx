import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import ApiDevice from '@/api/device';
import { DEVICE_TYPES } from '@/constants/deviceConstants';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';

import VTextarea from '@/components/VTextarea';
import VDialog from '@/components/VDialog';

const DeviceForm = ({ device, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const isEdit = !!device;
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: device?.name || '',
    type: device?.type || '',
    ipAddress: device?.ipAddress || device?.ip_address || '',
    macAddress: device?.macAddress || device?.mac_address || '',
    description: device?.description || '',
    status: device?.status || 'active'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.ipAddress || !formData.type || !formData.status) {
      toast.error(t('assets.form.error_required'));
      return;
    }

    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(formData.ipAddress.trim())) {
      toast.error(t('assets.form.error_ip'));
      return;
    }

    if (formData.macAddress && formData.macAddress.trim() !== '') {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(formData.macAddress.trim())) {
        toast.error(t('assets.form.error_mac'));
        return;
      }
    }

    try {
      setLoading(true);
      if (isEdit) {
        await ApiDevice.update(device.id || device._id, formData);
        toast.success(t('assets.form.update_success'));
      } else {
        await ApiDevice.create(formData);
        toast.success(t('assets.form.add_success'));
      }
      onSuccess();
    } catch (err) {
      console.error('Lỗi khi lưu thiết bị:', err);
      toast.error(t('assets.form.save_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <VDialog
      visible={true}
      onHide={onClose}
      header={isEdit ? t('assets.form.title_edit') : t('assets.form.title_add')}
      style={{ maxWidth: '50rem' }}
    >
      <form onSubmit={handleSubmit} className="device-form">
        
        <div className="form-row form-row-3">
          <VInput 
            label={t('assets.form.label_name')}
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('assets.form.placeholder_name')}
            className="mb-0"
            required={true}
          />
          
          <VInput 
            label={t('assets.form.label_ip')}
            name="ipAddress"
            value={formData.ipAddress}
            onChange={handleChange}
            placeholder={t('assets.form.placeholder_ip')}
            className="mb-0"
            required={true}
          />
        </div>

        <div className="form-row form-row-2">
          <div className="v-input-wrapper mb-0">
            <label className="v-input-label">
              {t('assets.form.label_type')}
              <span style={{ color: 'var(--red-500)', marginLeft: '0.2857rem' }}>*</span>
            </label>
            <select 
              name="type" 
              value={formData.type} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '0.7143rem 1rem', borderRadius: '0.5714rem', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '0.0714rem solid var(--slate-300)' }}
            >
              <option value="">{t('assets.form.select_type')}</option>
              {DEVICE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label} - {t.description}</option>
              ))}
            </select>
          </div>

          <div className="v-input-wrapper mb-0">
            <label className="v-input-label">
              {t('assets.form.label_status')}
              <span style={{ color: 'var(--red-500)', marginLeft: '0.2857rem' }}>*</span>
            </label>
            <select 
              name="status" 
              value={formData.status} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '0.7143rem 1rem', borderRadius: '0.5714rem', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '0.0714rem solid var(--slate-300)' }}
            >
              <option value="active">{t('assets.filter_status_active')}</option>
              <option value="inactive">{t('assets.filter_status_inactive')}</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <VTextarea 
            label={t('assets.form.label_desc')}
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder={t('assets.form.placeholder_desc')}
            className="mb-0"
            rows={3}
          />
        </div>

        <div style={{ marginTop: '1.7143rem', display: 'flex', justifyContent: 'flex-end', gap: '0.8571rem' }}>
          <VButton type="button" variant="outline" onClick={onClose}>
            {t('assets.form.btn_cancel')}
          </VButton>
          <VButton type="submit" variant="primary" loading={loading}>
            <Save size={18} />
            {isEdit ? t('assets.form.btn_update') : t('assets.form.btn_save')}
          </VButton>
        </div>
      </form>
    </VDialog>
  );
};

export default DeviceForm;
