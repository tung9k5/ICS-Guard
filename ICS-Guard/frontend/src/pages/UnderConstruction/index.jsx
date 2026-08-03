import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ArrowLeft } from 'lucide-react';
import VButton from '@/components/VButton';
import Viewlogo from '@/components/Viewlogo';

const UnderConstruction = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <Viewlogo size={390} />
      <h1>{t('status.title_under_construction', 'Tính năng đang phát triển')}</h1>
      <p>{t('status.under_construction', 'Tính năng này hiện chưa hoàn thiện và đang trong quá trình phát triển. Vui lòng quay lại sau.')}</p>
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

export default UnderConstruction;
