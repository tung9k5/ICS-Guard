import React from 'react';
import { Search } from 'lucide-react';
import VInput from '@/components/VInput';
import './VFilterPage.scss';

const VFilterPage = ({ searchPlaceholder = "Tìm kiếm...", searchValue, onSearchChange, children }) => {
  return (
    <div className="v-filter-page">
      <div className="filter-search">
        <VInput 
          placeholder={searchPlaceholder} 
          icon={Search}
          value={searchValue}
          onChange={onSearchChange}
          className="search-input"
        />
      </div>
      {children && (
        <div className="filter-actions">
          {children}
        </div>
      )}
    </div>
  );
};

export default VFilterPage;
