import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './VPagination.scss';

const VPagination = ({ page, perPage, total, onPageChange, onPerPageChange, dataLength, itemName = "dòng" }) => {
  return (
    <div className="v-pagination-wrapper">
      <div className="pagination-info">
        Tổng cộng: <strong>{total}</strong> {itemName}
      </div>
      <div className="pagination-controls">
        <select 
          className="per-page-select"
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
        >
          <option value={10}>10 / trang</option>
          <option value={20}>20 / trang</option>
          <option value={50}>50 / trang</option>
        </select>

        <div className="page-buttons">
          <button 
            className="icon-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          
          <span className="current-page">Trang {page}</span>
          
          <button 
            className="icon-btn"
            disabled={dataLength < perPage || page * perPage >= total}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VPagination;
