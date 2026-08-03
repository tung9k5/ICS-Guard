import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import ApiIncident from '@/api/incidents';
import { toast } from '@/utils/toast';
import VDialog from '@/components/VDialog';

const IncidentForm = ({ incident, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const isEdit = !!incident;
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: incident?.title || '',
    description: incident?.description || '',
    status: incident?.status || 'open',
    severity: incident?.severity || 'MEDIUM',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.status || !formData.severity) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    try {
      setLoading(true);
      if (isEdit) {
        await ApiIncident.update(incident.id || incident._id, formData);
        toast.success(t('incidents.create.update_success', 'Cập nhật sự cố thành công'));
      } else {
        await ApiIncident.createIncident(formData);
        toast.success(t('incidents.create.create_success', 'Tạo sự cố thủ công thành công'));
      }
      onSuccess();
    } catch (err) {
      console.error('Lỗi khi lưu sự cố:', err);
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi lưu sự cố');
    } finally {
      setLoading(false);
    }
  };

  return (
    <VDialog
      visible={true}
      onHide={onClose}
      header={isEdit ? 'Cập nhật sự cố' : 'Thêm sự cố'}
      style={{ maxWidth: '600px' }}
    >
      <form onSubmit={handleSubmit} className="incident-form">
        
        <div className="form-row">
          <VInput 
            label="Tên sự cố"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Nhập tên sự cố"
            className="mb-0"
            required={true}
          />
        </div>

        <div className="form-row form-row-2">
          <div className="v-input-wrapper mb-0">
            <label className="v-input-label">
              Mức độ nghiêm trọng
              <span style={{ color: 'var(--red-500)', marginLeft: '4px' }}>*</span>
            </label>
            <select 
              name="severity" 
              value={formData.severity} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)' }}
            >
              <option value="LOW">Thấp (Low)</option>
              <option value="MEDIUM">Trung bình (Medium)</option>
              <option value="HIGH">Cao (High)</option>
              <option value="CRITICAL">Nghiêm trọng (Critical)</option>
            </select>
          </div>

          <div className="v-input-wrapper mb-0">
            <label className="v-input-label">
              Trạng thái
              <span style={{ color: 'var(--red-500)', marginLeft: '4px' }}>*</span>
            </label>
            <select 
              name="status" 
              value={formData.status} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)' }}
            >
              <option value="open">Mở</option>
              <option value="investigating">Đang điều tra</option>
              <option value="remediated">Đã khắc phục</option>
              <option value="closed">Đã đóng</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <VInput 
            label="Mô tả"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Mô tả chi tiết sự cố"
            className="mb-0"
            type="textarea"
            rows={4}
          />
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <VButton type="button" variant="outline" onClick={onClose}>
            Hủy bỏ
          </VButton>
          <VButton type="submit" variant="primary" loading={loading}>
            <Save size={18} />
            {isEdit ? 'Cập nhật' : 'Lưu lại'}
          </VButton>
        </div>
      </form>
    </VDialog>
  );
};

export default IncidentForm;
