import { useState, useCallback, useEffect, useRef } from 'react';
import { showGlobalLoading, hideGlobalLoading } from '@/utils/loadingEvent';

export const useLoader = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);
  const globalLoadingActive = useRef(false);

  useEffect(() => {
    if (isLoading && !globalLoadingActive.current) {
      showGlobalLoading();
      globalLoadingActive.current = true;
    } else if (!isLoading && globalLoadingActive.current) {
      hideGlobalLoading();
      globalLoadingActive.current = false;
    }
    
    return () => {
      if (globalLoadingActive.current) {
        hideGlobalLoading();
        globalLoadingActive.current = false;
      }
    };
  }, [isLoading]);

  const showLoading = useCallback(() => setIsLoading(true), []);
  const hideLoading = useCallback(() => setIsLoading(false), []);

  return { isLoading, showLoading, hideLoading };
};
