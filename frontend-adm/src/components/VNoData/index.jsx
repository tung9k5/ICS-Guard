import React from 'react';

import './VNoData.scss';

const VNoData = ({ message = "Không có dữ liệu" }) => {
  return (
    <div className="v-no-data">
      <div className="no-data-icon-wrapper">
        <img src="/noData.png" alt="No data" className="no-data-icon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <p className="no-data-text">{message}</p>
    </div>
  );
};

export default VNoData;
