import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import VButton from '@/components/common/VButton/VButton';
import VInput from '@/components/common/VInput/VInput';
import deviceService from '@/services/deviceService';

const DeviceForm = ({ device, onClose, onSuccess }) => {
  const isEdit = !!device;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
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
      setError('Vui lòng nhập đầy đủ Tên, IP và địa chỉ MAC');
      return;
    }

    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(formData.ipAddress.trim())) {
      setError('Địa chỉ IP không hợp lệ. Vui lòng nhập đúng định dạng IPv4 (VD: 192.168.1.100)');
      return;
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(formData.macAddress.trim())) {
      setError('Địa chỉ MAC không hợp lệ. Vui lòng nhập đúng định dạng (VD: 00:1A:2B:3C:4D:5E hoặc 00-1A-2B-3C-4D-5E)');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (isEdit) {
        await deviceService.update(device.id || device._id, formData);
      } else {
        await deviceService.create(formData);
      }
      onSuccess();
    } catch (err) {
      console.error('Lỗi khi lưu thiết bị:', err);
      setError('Có lỗi xảy ra khi lưu thiết bị. Kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="device-modal-overlay">
      <div className="device-modal">
        <div className="modal-header">
          <h3>{isEdit ? 'Cập nhật thiết bị' : 'Thêm thiết bị mới'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert-error mb-4">{error}</div>}
          
          <VInput 
            label="Tên thiết bị *"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ví dụ: PLC-01"
            className="mb-4"
          />
          
          <VInput 
            label="Địa chỉ IP *"
            name="ipAddress"
            value={formData.ipAddress}
            onChange={handleChange}
            placeholder="Ví dụ: 192.168.1.100"
            className="mb-4"
          />

          <VInput 
            label="Địa chỉ MAC *"
            name="macAddress"
            value={formData.macAddress}
            onChange={handleChange}
            placeholder="Ví dụ: 00:1A:2B:3C:4D:5E"
            className="mb-4"
          />

          <VInput 
            label="Loại thiết bị"
            name="type"
            value={formData.type}
            onChange={handleChange}
            placeholder="Ví dụ: PLC, HMI, SCADA"
            className="mb-4"
          />

          <div className="form-group mb-4">
            <label className="v-input-label d-block mb-2">Trạng thái</label>
            <select 
              name="status" 
              value={formData.status} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Vô hiệu hóa</option>
            </select>
          </div>

          <VInput 
            label="Mô tả"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Nhập mô tả..."
            className="mb-4"
          />

          <div className="modal-footer">
            <VButton type="button" variant="secondary" onClick={onClose}>
              Hủy
            </VButton>
            <VButton type="submit" variant="primary" loading={loading}>
              <Save size={18} />
              {isEdit ? 'Cập nhật' : 'Thêm mới'}
            </VButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceForm;
