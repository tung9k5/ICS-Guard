import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './VHeaderPage.scss';

const VHeaderPage = ({ title, subtitle, action, backUrl = '/' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    navigate(backUrl);
  };

  return (
    <div className="v-header-page">
      <div className="header-left">
        <h1 className="page-title">
          <button className="back-btn" onClick={handleBack} title={t('common.back')}>
            <ChevronLeft className="icon" size={28} />
          </button>
          {title}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="header-action">{action}</div>}
    </div>
  );
};

export default VHeaderPage;
