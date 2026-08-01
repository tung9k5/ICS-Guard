import { useState, useCallback } from 'react';

export const useLoader = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);

  const showLoading = useCallback(() => setIsLoading(true), []);
  const hideLoading = useCallback(() => setIsLoading(false), []);

  return { isLoading, showLoading, hideLoading };
};
