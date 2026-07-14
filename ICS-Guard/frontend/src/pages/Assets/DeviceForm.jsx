import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import ApiDevice from '@/api/device';
import { DEVICE_TYPES } from '@/constants/deviceConstants';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import './DeviceForm.scss';

const DeviceForm = ({ device, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const isEdit = device && !device.isNew;
  const [loading, setLoading] = useState(false);
  const [parentDevices, setParentDevices] = useState([]);
  const [availableZones, setAvailableZones] = useState([]);
  
  const [formData, setFormData] = useState({
    name: device?.name || '',
    type: device?.type || device?.node_type || '',
    node_type: device?.node_type || device?.type || '',
    ipAddress: device?.ipAddress || device?.ip_address || '',
    macAddress: device?.macAddress || device?.mac_address || '',
    zone: device?.zone || 'Zone-A',
    parent_id: device?.parent_id || '',
    description: device?.description || '',
    status: device?.status || 'unprovisioned',
    icon_path: device?.icon_path || ''
  });

  // Load existing gateway and controller devices to populate the parent selection dropdown
  useEffect(() => {
    const loadParents = async () => {
      try {
        const res = await ApiDevice.getAll();
        let list = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (res && Array.isArray(res.data)) {
          list = res.data;
        }
        
        // Filter: only allow connecting to gateways or controllers, and prevent self-looping
        const filtered = list.filter(d => {
          const type = d.node_type || d.type || '';
          const isParentType = type === 'gateway' || type === 'controller';
          const isNotSelf = !isEdit || (d._id || d.id) !== (device._id || device.id);
          return isParentType && isNotSelf;
        });
        setParentDevices(filtered);
        
        // Extract unique zones
        const uniqueZones = Array.from(new Set(list.map(d => d.zone).filter(Boolean)));
        // Add defaults if they don't exist
        ['Zone-A', 'Zone-B', 'Zone-C'].forEach(z => {
          if (!uniqueZones.includes(z)) uniqueZones.push(z);
        });
        setAvailableZones(uniqueZones);
      } catch (err) {
        console.error('Failed to load parent devices:', err);
      }
    };
    loadParents();
  }, [isEdit, device]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.ipAddress || !formData.macAddress) {
      toast.error('Vui lòng nhập tên, địa chỉ IP và địa chỉ MAC.');
      return;
    }

    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(formData.ipAddress.trim())) {
      toast.error('Địa chỉ IP không đúng định dạng.');
      return;
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(formData.macAddress.trim())) {
      toast.error('Địa chỉ MAC không đúng định dạng.');
      return;
    }

    // Auto assign icon path based on selection if empty
    let iconPath = formData.icon_path;
    if (!iconPath) {
      const type = formData.node_type || formData.type;
      if (type === 'gateway') iconPath = 'Network';
      else if (type === 'controller') iconPath = 'Cpu';
      else if (type === 'chip') iconPath = 'Radio';
      else if (type === 'sensor') iconPath = 'Thermometer';
      else if (type === 'actuator') iconPath = 'Wind';
      else iconPath = 'HardDrive';
    }

    const payload = {
      ...formData,
      type: formData.node_type || formData.type || 'IoT Device',
      node_type: formData.node_type || formData.type || 'sensor',
      icon_path: iconPath,
      parent_id: formData.parent_id || null
    };

    try {
      setLoading(true);
      if (isEdit) {
        const res = await ApiDevice.update(device.id || device._id, payload);
        toast.success('Cập nhật thiết bị thành công!');
        onSuccess(res?.data || res);
      } else {
        const res = await ApiDevice.create(payload);
        toast.success('Thêm thiết bị mới thành công!');
        onSuccess(res?.data || res);
      }
    } catch (err) {
      console.error('Error saving device:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu thiết bị.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="device-drawer-overlay">
      <div className="device-drawer-content">
        <div className="drawer-header">
          <h3>{isEdit ? 'Chỉnh sửa cấu hình thiết bị' : 'Đăng ký thiết bị mới (Cắm nóng)'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="drawer-body">
          <div className="premium-form-row">
            <div className="premium-form-group">
              <label>Tên thiết bị *</label>
              <input 
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ví dụ: PLC-Siemens-S7"
              />
            </div>
            
            <div className="premium-form-group">
              <label>Loại thiết bị *</label>
              <select 
                name="node_type" 
                value={formData.node_type} 
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({ ...prev, node_type: val, type: val }));
                }}
                disabled={isEdit}
              >
                <option value="gateway">Industrial Gateway</option>
                <option value="controller">Controller PLC</option>
                <option value="chip">Edge Comm Module</option>
                <option value="sensor">Sensor</option>
                <option value="actuator">Actuator</option>
              </select>
            </div>
          </div>
          
          <div className="premium-form-row">
            <div className="premium-form-group">
              <label>Địa chỉ IP *</label>
              <input 
                name="ipAddress"
                value={formData.ipAddress}
                onChange={handleChange}
                placeholder="192.168.1.100"
                disabled={isEdit}
              />
            </div>

            <div className="premium-form-group">
              <label>Địa chỉ MAC *</label>
              <input 
                name="macAddress"
                value={formData.macAddress}
                onChange={handleChange}
                placeholder="00:1A:2B:3C:4D:5E"
                disabled={isEdit}
              />
            </div>
          </div>

          <div className="premium-form-group">
            <label>Phân vùng hệ thống (Zone) *</label>
            <input 
              name="zone" 
              value={formData.zone} 
              onChange={handleChange}
              list="zones-list"
              placeholder="Chọn hoặc nhập tên Zone mới (VD: Zone-D)"
            />
            <datalist id="zones-list">
              {availableZones.map(z => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>

          <div className="premium-form-group">
            <label>Kết nối trực thuộc (Parent Host)</label>
            <select 
              name="parent_id" 
              value={formData.parent_id} 
              onChange={handleChange}
            >
              <option value="">-- Chọn thiết bị cha (Để trống nếu là Gateway) --</option>
              {parentDevices.map(parent => (
                <option key={parent._id || parent.id} value={parent._id || parent.id}>
                  [{parent.zone}] {parent.name} ({parent.ipAddress || parent.ip_address})
                </option>
              ))}
            </select>
          </div>

          <div className="premium-form-group">
            <label>Trạng thái mạng</label>
            <select 
              name="status" 
              value={formData.status} 
              onChange={handleChange}
            >
              <option value="unprovisioned">Chờ duyệt (Unprovisioned)</option>
              <option value="active">Đang bảo vệ (Active)</option>
              <option value="inactive">Không hoạt động (Inactive)</option>
            </select>
          </div>

          <div className="premium-form-group" style={{ flex: 1 }}>
            <label>Mô tả kỹ thuật</label>
            <textarea 
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Ghi chú chi tiết về vị trí lắp đặt, công dụng của thiết bị..."
            />
          </div>
        </form>

        <div className="drawer-footer">
          <VButton type="button" variant="secondary" onClick={onClose}>
            Hủy bỏ
          </VButton>
          <VButton type="button" variant="primary" loading={loading} onClick={handleSubmit}>
            <Save size={18} style={{ marginRight: '8px' }} />
            {isEdit ? 'Lưu cấu hình' : 'Khởi chạy thiết bị'}
          </VButton>
        </div>
      </div>
    </div>
  );
};

export default DeviceForm;
