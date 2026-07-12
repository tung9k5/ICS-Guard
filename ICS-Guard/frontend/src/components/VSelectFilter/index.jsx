import React from 'react';
import { X } from 'lucide-react';
import './VSelectFilter.scss';

/**
 * VSelectFilter – A select dropdown with a clearable X button.
 * Props:
 *   value        – current value
 *   defaultValue – value treated as "no filter" (default: 'all')
 *   onChange     – (newValue: string) => void
 *   options      – [{ value, label }]
 *   placeholder  – text for the default "all" option
 */
const VSelectFilter = ({
  value,
  defaultValue = 'all',
  onChange,
  options = [],
  placeholder = 'Tất cả',
}) => {
  const isFiltered = value !== defaultValue;

  return (
    <div className="v-select-filter-wrap">
      <select
        className="v-select-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={defaultValue}>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {isFiltered && (
        <button
          className="v-select-clear"
          onClick={() => onChange(defaultValue)}
          title="Xóa bộ lọc"
          type="button"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

export default VSelectFilter;
