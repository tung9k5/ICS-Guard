export const getSeverityVariant = (severity) => {
  const map = {
    CRITICAL: 'danger',
    HIGH: 'warning',
    MEDIUM: 'neutral',
  };
  return map[severity] || 'success';
};

export const getSelectionState = (items = [], selectedIds = []) => ({
  allSelected: items.length > 0 && selectedIds.length === items.length,
  indeterminate: selectedIds.length > 0 && selectedIds.length < items.length,
});
