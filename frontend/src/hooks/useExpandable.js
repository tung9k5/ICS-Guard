import { useState, useCallback } from 'react';

export const useExpandable = () => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return { expandedId, toggleExpand };
};
