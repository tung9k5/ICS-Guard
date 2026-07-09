import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import './VHeaderPage.scss';

const VHeaderPage = ({ title, subtitle, action, backUrl = '/' }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(backUrl);
  };

  return (
    <div className="v-header-page">
      <div className="header-left">
        <h1 className="page-title">
          <button className="back-btn" onClick={handleBack} title="Trở về">
            <ChevronLeft className="icon" size={28} />
          </button>
          {title}
        </h1>
      </div>
      {action && <div className="header-action">{action}</div>}
    </div>
  );
};

export default VHeaderPage;
