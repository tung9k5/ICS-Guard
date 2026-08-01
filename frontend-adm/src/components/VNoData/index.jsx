import React from 'react';
import { Shield } from 'lucide-react';
import './VNoData.scss';

const VNoData = ({ message = "Không có dữ liệu" }) => {
  return (
    <div className="v-no-data">
      <div className="no-data-icon-wrapper">
        <Shield size={72} className="no-data-icon" />
      </div>
      <p className="no-data-text">{message}</p>
    </div>
  );
};

export default VNoData;
