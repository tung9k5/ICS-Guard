import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, User as UserIcon, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usersApi from '@/api/users';
import './ProfileModal.scss';

const ProfileModal = ({ user, onClose, onUpdate }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    avatar: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        // "get theo user id"
        const res = await usersApi.getUserById(user.id || user._id);
        const userData = res.data || res;
        setFormData({
          full_name: userData.full_name || '',
          email: userData.email || '',
          avatar: userData.avatar || null
        });
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };
    if (user && (user.id || user._id)) {
      fetchUser();
    }
  }, [user]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await usersApi.updateProfile({
        full_name: formData.full_name,
        avatar: formData.avatar
        // email is not sent because it's not editable
      });
      if (onUpdate) {
        onUpdate(res.data?.user || res.user || { ...user, full_name: formData.full_name, avatar: formData.avatar });
      }
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-modal-overlay">
      <div className="profile-modal-content">
        <div className="modal-header">
          <h3>{t('profile.title')}</h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        {loading ? (
          <div className="modal-loading">{t('profile.loading')}</div>
        ) : (
          <form onSubmit={handleSubmit} className="profile-form-layout">
            <div className="avatar-side" onClick={handleUploadClick}>
              <div className="avatar-frame">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="Avatar Preview" />
                ) : (
                  <div className="avatar-placeholder"><UserIcon size={60} /></div>
                )}
                <div className="avatar-overlay">
                  <Upload size={24} />
                  <span>{t('profile.upload_image')}</span>
                </div>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                hidden 
              />
            </div>
            
            <div className="info-side">
              <div className="form-group">
                <label>{t('profile.full_name')}</label>
                <input 
                  type="text" 
                  value={formData.full_name} 
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder={t('profile.enter_full_name')}
                />
              </div>
              <div className="form-group">
                <label>{t('profile.email_readonly')}</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  disabled
                  className="disabled-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>{t('profile.cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? t('profile.saving') : <><Check size={16} /> {t('profile.save')}</>}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
