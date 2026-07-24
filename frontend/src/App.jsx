import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from '@/routes/AppRoutes';

import IdleTimeout from '@/Dialog/IdleTimeout';
import authApi from '@/api/auth';
import { AUTH_KEYS } from '@/constants/authConstants';

function App() {
  useEffect(() => {
    const isAttacker = window.location.pathname.startsWith('/attacker');
    const refreshTokenKey = isAttacker ? AUTH_KEYS.ATTACKER_REFRESH_TOKEN : AUTH_KEYS.REFRESH_TOKEN;
    const accessTokenKey = isAttacker ? AUTH_KEYS.ATTACKER_ACCESS_TOKEN : AUTH_KEYS.ACCESS_TOKEN;
    
    const existingRefreshToken = localStorage.getItem(refreshTokenKey);
    if (existingRefreshToken) {
      authApi.refreshToken({})
        .then(res => {
          const newRefreshToken = res?.refreshToken || res?.data?.refreshToken;
          const newAccessToken = res?.accessToken || res?.data?.accessToken;
          if (newRefreshToken) localStorage.setItem(refreshTokenKey, newRefreshToken);
          if (newAccessToken) localStorage.setItem(accessTokenKey, newAccessToken);
        })
        .catch(err => {
          console.error("Auto refresh token failed:", err);
        });
    }
  }, []);

  return (
    <BrowserRouter>
      <IdleTimeout />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
