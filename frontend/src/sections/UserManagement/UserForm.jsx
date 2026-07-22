import React, { useState } from 'react';
import { Save } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import ApiUser from '@/api/users';
import { toast } from '@/utils/toast';
import VDialog from '@/components/VDialog';
import { useTranslation } from 'react-i18next';

const UserForm = ({ user, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const isEdit = !!user;
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    full_name: user?.full_name || '',
    role: user?.role || 'l1_analyst',
    is_active: user?.is_active ?? true,
    password: ''
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.role || (!isEdit && !formData.password)) {
      toast.error(t('common.error_required', 'Vui lòng điền đầy đủ các trường bắt buộc'));
      return;
    }

    try {
      setLoading(true);
      if (isEdit) {
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        await ApiUser.updateUser(user.id || user._id, updateData);
        toast.success(t('users.update_success', 'Cập nhật người dùng thành công'));
      } else {
        await ApiUser.createUser(formData);
        toast.success(t('users.create_success', 'Thêm người dùng mới thành công'));
      }
      onSuccess();
    } catch (err) {
      console.error('Lỗi khi lưu người dùng:', err);
      toast.error(err?.response?.data?.message || t('users.save_error', 'Có lỗi xảy ra khi lưu người dùng'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <VDialog
      visible={true}
      onHide={onClose}
      header={isEdit ? 'Cập nhật người dùng' : 'Thêm người dùng mới'}
      style={{ maxWidth: '600px' }}
    >
      <form onSubmit={handleSubmit} className="user-form">
        
        <div className="form-row form-row-2">
          <VInput 
            label="Tên đăng nhập"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Nhập tên đăng nhập"
            className="mb-0"
            required={true}
          />
          
          <VInput 
            label="Họ và tên"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="Nhập họ và tên"
            className="mb-0"
          />
        </div>

        <div className="form-row form-row-2">
          <VInput 
            label="Email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Nhập email"
            className="mb-0"
            type="email"
            required={true}
            disabled={isEdit}
          />

          {!isEdit ? (
            <VInput 
              label="Mật khẩu"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Nhập mật khẩu"
              className="mb-0"
              type="password"
              required={true}
            />
          ) : (
            <div></div>
          )}
        </div>

        <div className="form-row form-row-2">
          <div className="v-input-wrapper mb-0">
            <label className="v-input-label">
              Vai trò
              <span style={{ color: 'var(--red-500)', marginLeft: '4px' }}>*</span>
            </label>
            <select 
              name="role" 
              value={formData.role} 
              onChange={handleChange}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)' }}
            >
              <option value="admin">Quản trị viên</option>
              <option value="l1_analyst">Nhà phân tích (L1)</option>
              <option value="l2_responder">Phản ứng viên (L2)</option>
              <option value="l3_manager">Quản lý (L3)</option>
              <option value="ot_operator">Vận hành viên (OT)</option>
            </select>
          </div>

          <div className="v-input-wrapper mb-0">
            <label className="v-input-label">
              Trạng thái
              <span style={{ color: 'var(--red-500)', marginLeft: '4px' }}>*</span>
            </label>
            <select 
              name="is_active" 
              value={formData.is_active} 
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
              className="v-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--white)', color: 'var(--slate-900)', border: '1px solid var(--slate-300)' }}
            >
              <option value="true">Hoạt động</option>
              <option value="false">Không hoạt động</option>
            </select>
          </div>
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

export default UserForm;
