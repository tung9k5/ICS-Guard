import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import VButton from '@/components/common/VButton/VButton';
import VInput from '@/components/common/VInput/VInput';
import ApiDevice from '@/api/device';
import { DEVICE_TYPES } from '@/constants/deviceConstants';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';

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
    if (!formData.name || !formData.ipAddress || !formData.macAddress) {
      toast.error(t('assets.form.error_required'));
      return;
    }

    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(formData.ipAddress.trim())) {
      toast.error(t('assets.form.error_ip'));
      return;
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(formData.macAddress.trim())) {
      toast.error(t('assets.form.error_mac'));
      return;
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
    <div className="device-modal-overlay">
      <div className="device-modal">
        <div className="modal-header">
          <h3>{isEdit ? t('assets.form.title_edit') : t('assets.form.title_add')}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          
          <VInput 
            label={t('assets.form.label_name')}
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('assets.form.placeholder_name')}
            className="mb-4"
          />
          
          <VInput 
            label={t('assets.form.label_ip')}
            name="ipAddress"
            value={formData.ipAddress}
            onChange={handleChange}
            placeholder={t('assets.form.placeholder_ip')}
            className="mb-4"
          />

          <VInput 
            label={t('assets.form.label_mac')}
            name="macAddress"
            value={formData.macAddress}
            onChange={handleChange}
            placeholder={t('assets.form.placeholder_mac')}
            className="mb-4"
          />

          <div className="form-group mb-4">
            <label className="v-input-label d-block mb-2">{t('assets.form.label_type')}</label>
            <select 
              name="type" 
              value={formData.type} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
            >
              <option value="">{t('assets.form.select_type')}</option>
              {DEVICE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label} - {t.description}</option>
              ))}
            </select>
          </div>

          <div className="form-group mb-4">
            <label className="v-input-label d-block mb-2">{t('assets.form.label_status')}</label>
            <select 
              name="status" 
              value={formData.status} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
            >
              <option value="active">{t('assets.filter_status_active')}</option>
              <option value="inactive">{t('assets.filter_status_inactive')}</option>
            </select>
          </div>

          <VInput 
            label={t('assets.form.label_desc')}
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder={t('assets.form.placeholder_desc')}
            className="mb-4"
          />

          <div className="modal-footer">
            <VButton type="button" variant="secondary" onClick={onClose}>
              {t('assets.form.btn_cancel')}
            </VButton>
            <VButton type="submit" variant="primary" loading={loading}>
              <Save size={18} />
              {isEdit ? t('assets.form.btn_update') : t('assets.form.btn_save')}
            </VButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceForm;
