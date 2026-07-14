import React, { useState, useEffect, useMemo } from 'react';
import apiUsers from '@/api/users';
import socket from '@/services/socket';
import { 
  User, Mail, Shield, ShieldCheck, UserCheck, UserX, Trash2, Edit, Plus, X, 
  Send, Bell, BellOff, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { toast } from '@/utils/toast';
import './UserManagement.scss';

const ROLE_LABELS = {
  admin: 'Administrator',
  hr_manager: 'HR Manager',
  device_manager: 'Device Manager',
  analyst: 'SOC Analyst'
};

const ROLE_COLORS = {
  admin: '#ef4444',
  hr_manager: '#3b82f6',
  device_manager: '#f59e0b',
  analyst: '#10b981'
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Search states
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal form states
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: 'analyst',
    telegramUsername: '',
    telegramChatId: '',
    phoneNumber: '',
    isAlertEnabled: true,
    is_active: true
  });

  const fetchUsers = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await apiUsers.getAllUsers();
      if (Array.isArray(res)) {
        setUsers(res);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Lỗi khi tải danh sách thành viên.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(true);

    // WebSocket listener for real-time user sync (create/update/delete)
    socket.on('USER_SYNC', (data) => {
      console.log('[UserManagement WebSocket] USER_SYNC received:', data);
      if (data.action === 'create') {
        setUsers(prev => {
          if (prev.some(u => u._id === data.user._id)) return prev;
          return [...prev, data.user];
        });
        toast.info(`👤 Người dùng "${data.user.username}" đã được tạo/phục hồi thành công!`);
      } else if (data.action === 'update') {
        setUsers(prev => prev.map(u => u._id === data.user._id ? data.user : u));
      } else if (data.action === 'delete') {
        setUsers(prev => prev.filter(u => u._id !== data.userId));
        toast.warning(`👤 Một tài khoản người dùng đã bị xóa.`);
      }
    });

    return () => {
      socket.off('USER_SYNC');
    };
  }, []);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setEditingId(null);
    setForm({
      username: '',
      password: '',
      email: '',
      full_name: '',
      role: 'analyst',
      telegramUsername: '',
      telegramChatId: '',
      phoneNumber: '',
      isAlertEnabled: true,
      is_active: true
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (user) => {
    setIsEdit(true);
    setEditingId(user._id);
    setForm({
      username: user.username || '',
      password: '', // blank for edit
      email: user.email || '',
      full_name: user.full_name || '',
      role: user.role || 'analyst',
      telegramUsername: user.contactInfo?.telegramUsername || '',
      telegramChatId: user.contactInfo?.telegramChatId || '',
      phoneNumber: user.contactInfo?.phoneNumber || '',
      isAlertEnabled: user.isAlertEnabled !== false,
      is_active: user.is_active !== false
    });
    setIsOpen(true);
  };

  const handleDelete = async (user) => {
    if (window.confirm(`Bạn có chắc muốn xóa tài khoản "${user.username}"? HR Manager có 5 phút để Hoàn tác khôi phục trên Telegram.`)) {
      try {
        await apiUsers.deleteUser(user._id);
        toast.success(`Đã xóa tài khoản "${user.username}". Kiểm tra Telegram để hoàn tác nếu cần.`);
        fetchUsers();
      } catch (error) {
        console.error('Delete user error:', error);
        toast.error(error.response?.data?.message || 'Xóa tài khoản thất bại.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || (!isEdit && !form.password)) {
      toast.error('Vui lòng nhập đầy đủ các trường bắt buộc.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: form.username,
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        is_active: form.is_active,
        isAlertEnabled: form.isAlertEnabled,
        contactInfo: {
          telegramUsername: form.telegramUsername || null,
          telegramChatId: form.telegramChatId || null,
          phoneNumber: form.phoneNumber || null
        }
      };

      if (form.password) {
        payload.password = form.password;
      }

      if (isEdit) {
        await apiUsers.updateUser(editingId, payload);
        toast.success('Cập nhật tài khoản thành công!');
      } else {
        await apiUsers.createUser(payload);
        toast.success('Tạo tài khoản mới thành công!');
      }
      setIsOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Save user error:', error);
      toast.error(error.response?.data?.message || 'Lưu tài khoản thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter list
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        (user.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesRole = !selectedRole || user.role === selectedRole;
      const matchesStatus = 
        !selectedStatus || 
        (selectedStatus === 'active' && user.is_active !== false) ||
        (selectedStatus === 'blocked' && user.is_active === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, selectedRole, selectedStatus]);

  const canManageUsers = useMemo(() => {
    try {
      const cached = sessionStorage.getItem('cached_user');
      const currentUser = cached ? JSON.parse(cached) : null;
      return currentUser?.role === 'admin' || currentUser?.role === 'hr_manager';
    } catch (e) {
      return false;
    }
  }, []);

  return (
    <div className="users-management-page">
      <div className="users-header">
        <div className="title-section">
          <h1>Quản lý Thành viên & Nhân sự</h1>
          <p>Phân quyền vài trò chi tiết. Thiết lập cảnh báo Telegram cá nhân và cấu hình quy trình Hoàn tác khôi phục.</p>
        </div>
        {canManageUsers && (
          <button className="add-member-btn" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Thêm thành viên</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Tìm kiếm theo tên, username, email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="select-filters">
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            <option value="">Tất cả Vai trò</option>
            <option value="admin">Administrator</option>
            <option value="hr_manager">HR Manager</option>
            <option value="device_manager">Device Manager</option>
            <option value="analyst">SOC Analyst</option>
          </select>

          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="">Tất cả Trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="blocked">Đang bị khóa</option>
          </select>

          <button className="refresh-btn" onClick={() => fetchUsers(false)} title="Làm mới danh sách">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="users-loading">Đang tải danh sách tài khoản thành viên...</div>
      ) : (
        <div className="users-grid">
          {filteredUsers.length === 0 ? (
            <div className="empty-users-state">Không tìm thấy thành viên nào khớp với bộ lọc.</div>
          ) : (
            filteredUsers.map(user => {
              const isTelegramLinked = !!user.contactInfo?.telegramChatId;
              return (
                <div key={user._id} className={`user-card ${user.is_active === false ? 'blocked' : ''}`}>
                  <div className="card-top">
                    <div className="avatar-circle">
                      <User size={24} />
                    </div>
                    <div className="user-title">
                      <h3>{user.full_name || 'N/A'}</h3>
                      <span className="username">@{user.username}</span>
                    </div>
                    <span 
                      className="role-badge" 
                      style={{ backgroundColor: `${ROLE_COLORS[user.role]}15`, color: ROLE_COLORS[user.role], border: `1px solid ${ROLE_COLORS[user.role]}30` }}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </div>

                  <div className="card-body">
                    <div className="info-row">
                      <Mail size={14} className="icon" />
                      <span>{user.email}</span>
                    </div>

                    <div className="info-row">
                      <Shield size={14} className="icon" />
                      <span>Trạng thái: 
                        <strong className={user.is_active !== false ? 'green-text' : 'red-text'}>
                          {user.is_active !== false ? ' Hoạt động' : ' Bị khóa'}
                        </strong>
                      </span>
                    </div>

                    <div className="info-row">
                      <Send size={14} className="icon" />
                      <span>Telegram: {isTelegramLinked ? (
                        <strong className="green-text" title={`Chat ID: ${user.contactInfo.telegramChatId}`}>
                          Linked (@{user.contactInfo.telegramUsername || 'N/A'})
                        </strong>
                      ) : (
                        <span className="gray-text">Chưa liên kết</span>
                      )}</span>
                    </div>

                    <div className="info-row">
                      {user.isAlertEnabled !== false ? (
                        <span className="green-text flex-align"><Bell size={14} className="icon" /> Nhận cảnh báo an ninh</span>
                      ) : (
                        <span className="gray-text flex-align"><BellOff size={14} className="icon" /> Tắt nhận cảnh báo</span>
                      )}
                    </div>
                  </div>

                  {canManageUsers && (
                    <div className="card-actions">
                      <button className="edit-btn" onClick={() => handleOpenEdit(user)}>
                        <Edit size={14} />
                        <span>Sửa</span>
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(user)}>
                        <Trash2 size={14} />
                        <span>Xóa</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Edit/Add Modal Overlay */}
      {isOpen && (
        <div className="user-modal-overlay">
          <div className="user-modal">
            <div className="modal-header">
              <h2>{isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm thành viên mới'}</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-grid">
                <div className="form-item">
                  <label>Tên đăng nhập (Username) *</label>
                  <input 
                    type="text" 
                    value={form.username} 
                    onChange={(e) => setForm({...form, username: e.target.value})}
                    disabled={isEdit}
                    required
                  />
                </div>

                {!isEdit && (
                  <div className="form-item">
                    <label>Mật khẩu đăng nhập *</label>
                    <input 
                      type="password" 
                      value={form.password} 
                      onChange={(e) => setForm({...form, password: e.target.value})}
                      required={!isEdit}
                    />
                  </div>
                )}

                <div className="form-item">
                  <label>Email liên hệ *</label>
                  <input 
                    type="email" 
                    value={form.email} 
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    required
                  />
                </div>

                <div className="form-item">
                  <label>Họ và Tên</label>
                  <input 
                    type="text" 
                    value={form.full_name} 
                    onChange={(e) => setForm({...form, full_name: e.target.value})}
                  />
                </div>

                <div className="form-item">
                  <label>Số điện thoại</label>
                  <input 
                    type="text" 
                    value={form.phoneNumber} 
                    onChange={(e) => setForm({...form, phoneNumber: e.target.value})}
                  />
                </div>

                <div className="form-item">
                  <label>Vai trò hệ thống</label>
                  <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
                    <option value="analyst">SOC Analyst (Giám sát viên)</option>
                    <option value="device_manager">Device Manager (Quản lý thiết bị)</option>
                    <option value="hr_manager">HR Manager (Quản lý nhân sự)</option>
                    <option value="admin">Administrator (Quản trị viên)</option>
                  </select>
                </div>

                <div className="form-item">
                  <label>Telegram Username (Không kèm @)</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: lam_tung_9k"
                    value={form.telegramUsername} 
                    onChange={(e) => setForm({...form, telegramUsername: e.target.value})}
                  />
                </div>

                <div className="form-item">
                  <label>Telegram Chat ID</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: 8908531668"
                    value={form.telegramChatId} 
                    onChange={(e) => setForm({...form, telegramChatId: e.target.value})}
                  />
                </div>

                <div className="form-checkbox-item span-2">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={form.isAlertEnabled} 
                      onChange={(e) => setForm({...form, isAlertEnabled: e.target.checked})}
                    />
                    <span>Nhận cảnh báo an ninh bảo mật lập tức qua Telegram Bot cá nhân</span>
                  </label>
                </div>

                <div className="form-checkbox-item span-2">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={form.is_active} 
                      onChange={(e) => setForm({...form, is_active: e.target.checked})}
                    />
                    <span>Kích hoạt tài khoản người dùng hoạt động trên Grid</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="save-btn" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
