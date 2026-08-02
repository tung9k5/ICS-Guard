import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ArrowLeft } from 'lucide-react';
import VButton from '@/components/VButton';
import Viewlogo from '@/components/Viewlogo';

const NotFound = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <Viewlogo size={390} />
      <h1>404</h1>
      <p>{t('status.not_found', 'Trang này không tồn tại hoặc đã bị gỡ bỏ.')}</p>
      <div className="status-actions">
        <VButton variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> {t('status.go_back', 'Quay lại')}
        </VButton>
        <VButton variant="primary" onClick={() => navigate('/')}>
          <Home size={16} /> {t('status.go_home', 'Về trang chủ')}
        </VButton>
      </div>
    </>
  );
};

export default NotFound;
