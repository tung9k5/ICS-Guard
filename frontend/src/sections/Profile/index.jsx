import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, User as UserIcon, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usersApi from '@/api/users';
import authApi from '@/api/auth';
import VInput from '@/components/VInput';
import VButton from '@/components/VButton';
import VDialog from '@/components/VDialog';
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
        // Lấy profile của user hiện tại
        const res = await authApi.getProfile();
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
    fetchUser();
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
        onUpdate(res?.data?.user || res?.user || { ...user, full_name: formData.full_name, avatar: formData.avatar });
      }
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <VDialog
      visible={true}
      onHide={onClose}
      header={t('profile.title')}
      style={{ maxWidth: '42.8571rem' }}
    >
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
            <VInput 
              label={t('profile.full_name')}
              name="full_name"
              value={formData.full_name} 
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              placeholder={t('profile.enter_full_name')}
            />
            
            <VInput 
              label={t('profile.email_readonly')}
              name="email"
              value={formData.email} 
              disabled
            />

            <div style={{ marginTop: 'auto', paddingTop: '0.5714rem', display: 'flex', justifyContent: 'flex-end', gap: '0.8571rem' }}>
              <VButton type="button" variant="outline" onClick={onClose}>
                {t('profile.cancel')}
              </VButton>
              <VButton type="submit" variant="primary" disabled={saving} loading={saving}>
                <Check size={16} style={{ marginRight: '0.5714rem' }} /> {saving ? t('profile.saving') : t('profile.save')}
              </VButton>
            </div>
          </div>
        </form>
      )}
    </VDialog>
  );
};

export default ProfileModal;
