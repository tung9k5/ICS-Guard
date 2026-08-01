export const loadingEvent = new EventTarget();

let activeRequests = 0;

export const showGlobalLoading = () => {
  activeRequests++;
  if (activeRequests === 1) {
    loadingEvent.dispatchEvent(new Event('show'));
  }
};

export const hideGlobalLoading = () => {
  activeRequests--;
  if (activeRequests <= 0) {
    activeRequests = 0;
    loadingEvent.dispatchEvent(new Event('hide'));
  }
};
