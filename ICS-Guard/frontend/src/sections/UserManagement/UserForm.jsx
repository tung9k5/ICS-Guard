import React, { useState } from 'react';
import { Save } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import ApiUser from '@/api/users';
import { toast } from '@/utils/toast';
import VDialog from '@/components/VDialog';
import CredentialsModal from './CredentialsModal';

const UserForm = ({ user, onClose, onSuccess }) => {
  const isEdit = !!user;
  const [loading, setLoading] = useState(false);
  const [newUserCredentials, setNewUserCredentials] = useState(null);
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    full_name: user?.full_name || '',
    role: user?.role || 'analyst',
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
    if (!formData.email || !formData.role) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc');
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
        toast.success('Cập nhật người dùng thành công');
        onSuccess();
      } else {
        const response = await ApiUser.createUser(formData);
        const resData = response?.data || response;
        const tempPassword = resData?.tempPassword || resData?.temp_password_plain;

        if (tempPassword) {
          setNewUserCredentials({
            username: resData.username || formData.username,
            tempPassword: tempPassword,
            role: formData.role
          });
        } else {
          toast.success('Thêm người dùng mới thành công');
          onSuccess();
        }
      }
    } catch (err) {
      console.error('Lỗi khi lưu người dùng:', err);
      const errMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Có lỗi xảy ra khi lưu người dùng';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <VDialog
        visible={true}
        onHide={onClose}
        header={isEdit ? 'Cập nhật người dùng' : 'Thêm người dùng mới'}
        style={{ maxWidth: '600px' }}
      >
        <form onSubmit={handleSubmit} className="user-form">
          {isEdit ? (
            <>
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
                  disabled={true}
                />
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
                    <option value="admin">Quản trị viên (Admin)</option>
                    <option value="hr_management">Quản lý nhân sự (HR)</option>
                    <option value="device_management">Quản lý thiết bị</option>
                    <option value="analyst">Chuyên viên phân tích</option>
                  </select>
                </div>
              </div>

              {user?.isFirstLogin === true && (
                <div className="v-input-wrapper mb-0" style={{ marginTop: '12px' }}>
                  <label className="v-input-label" style={{ color: '#fbbf24', fontWeight: 600 }}>
                    🔑 Mật Khẩu Tạm Thời (Chưa Đổi Lần Đầu):
                  </label>
                  <input 
                    type="text" 
                    readOnly 
                    value={user?.temp_password_plain || 'Mật khẩu ngẫu nhiên tạm thời'} 
                    className="v-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: 'bold', fontFamily: 'monospace', border: '1px solid #3b82f6' }}
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    * Mật khẩu này sẽ tự động ẩn đi vĩnh viễn ngay sau khi người dùng đăng nhập lần đầu và đổi mật khẩu mới.
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="form-row form-row-2">
                <VInput 
                  label="Họ và tên"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Nhập họ và tên"
                  className="mb-0"
                />
                
                <VInput 
                  label="Email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Nhập email"
                  className="mb-0"
                  type="email"
                  required={true}
                />
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
                    <option value="admin">Quản trị viên (Admin)</option>
                    <option value="hr_management">Quản lý nhân sự (HR)</option>
                    <option value="device_management">Quản lý thiết bị</option>
                    <option value="analyst">Chuyên viên phân tích</option>
                  </select>
                </div>
                <div></div>
              </div>
            </>
          )}

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

      {newUserCredentials && (
        <CredentialsModal
          credentials={newUserCredentials}
          onClose={() => {
            setNewUserCredentials(null);
            onSuccess();
          }}
        />
      )}
    </>
  );
};

export default UserForm;
