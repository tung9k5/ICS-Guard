import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider, useDispatch } from 'react-redux';
import { store } from '@/store';
import { loginSuccess, logout, setInitialized } from '@/store/slices/authSlice';
import AppRoutes from '@/routes/AppRoutes';
import ErrorBoundary from '@/components/ErrorBoundary';

import IdleTimeout from '@/Dialog/IdleTimeout';
import authApi from '@/api/auth';

function AppContent() {
  const dispatch = useDispatch();

  useEffect(() => {
    const path = window.location.pathname;
    if ((path.endsWith('/login') || path.endsWith('/register')) && !path.includes('callback')) {
      dispatch(setInitialized());
      return;
    }

    authApi.refreshToken({}, { _silent: true })
      .then(res => {
        if (res && (res.accessToken)) {
          authApi.getProfile()
            .then(profile => {
              dispatch(loginSuccess({
                user: profile.data,
                accessToken: res.accessToken
              }));
            })
            .catch(() => dispatch(logout()));
        }
      })
      .catch(err => {
        console.error("Auto refresh token failed or no cookie:", err);
        dispatch(logout()); 
      });
  }, [dispatch]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <IdleTimeout />
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;

