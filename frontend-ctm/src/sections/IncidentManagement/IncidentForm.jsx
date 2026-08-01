import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import incidentsApi from '@/api/incidents';
import { toast } from '@/utils/toast';
import VDialog from '@/components/VDialog';

const IncidentForm = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open',
    severity: 'MEDIUM',
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
    if (!formData.title || !formData.severity) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    try {
      setLoading(true);
      await incidentsApi.createIncident(formData);
      toast.success('Báo cáo sự cố thành công');
      onSuccess();
    } catch (err) {
      console.error('Lỗi khi lưu sự cố:', err);
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi tạo báo cáo sự cố');
    } finally {
      setLoading(false);
    }
  };

  return (
    <VDialog
      visible={true}
      onHide={onClose}
      header="Báo cáo sự cố"
      style={{ maxWidth: '42.8571rem' }}
    >
      <form onSubmit={handleSubmit} className="incident-form">
        
        <div className="form-row">
          <VInput 
            label="Tiêu đề sự cố"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Nhập tiêu đề sự cố ngắn gọn"
            className="mb-0"
            required={true}
          />
        </div>

        <div className="form-row form-row-2">
          <div className="v-input-wrapper mb-0" style={{ width: '100%' }}>
            <label className="v-input-label">
              Mức độ nghiêm trọng
              <span style={{ color: 'var(--red-500)', marginLeft: '0.2857rem' }}>*</span>
            </label>
            <select 
              name="severity" 
              value={formData.severity} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '0.7143rem 1rem', borderRadius: '0.5714rem', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '0.0714rem solid var(--slate-300)' }}
            >
              <option value="LOW">Thấp (Low)</option>
              <option value="MEDIUM">Trung bình (Medium)</option>
              <option value="HIGH">Cao (High)</option>
              <option value="CRITICAL">Nghiêm trọng (Critical)</option>
            </select>
          </div>

          <div className="v-input-wrapper mb-0" style={{ width: '100%' }}>
            <label className="v-input-label">
              Trạng thái
            </label>
            <select 
              name="status" 
              value={formData.status} 
              disabled={true}
              className="v-input"
              style={{ width: '100%', padding: '0.7143rem 1rem', borderRadius: '0.5714rem', backgroundColor: 'var(--slate-100)', color: 'var(--slate-500)', border: '0.0714rem solid var(--slate-300)' }}
            >
              <option value="open">Mở (Chờ xử lý)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <VInput 
            label="Mô tả chi tiết"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Mô tả chi tiết tình trạng sự cố để Admin xử lý..."
            className="mb-0"
            type="textarea"
            rows={4}
          />
        </div>

        <div style={{ marginTop: '1.7143rem', display: 'flex', justifyContent: 'flex-end', gap: '0.8571rem' }}>
          <VButton type="button" variant="outline" onClick={onClose}>
            Hủy bỏ
          </VButton>
          <VButton type="submit" variant="primary" loading={loading}>
            <Save size={18} />
            Báo cáo
          </VButton>
        </div>
      </form>
    </VDialog>
  );
};

export default IncidentForm;
