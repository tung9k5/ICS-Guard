import { useState, useCallback } from 'react';

export const useSelection = (items = [], idKey = 'id', fallbackIdKey = '_id') => {
  const [selectedIds, setSelectedIds] = useState([]);

  const handleSelect = useCallback((id, isSelected) => {
    if (isSelected) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  }, []);

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      const allIds = items.map(item => item[idKey] || item[fallbackIdKey]);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  }, [items, idKey, fallbackIdKey]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  return {
    selectedIds,
    handleSelect,
    handleSelectAll,
    clearSelection,
    setSelectedIds
  };
};
