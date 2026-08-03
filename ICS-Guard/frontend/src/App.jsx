import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from '@/routes/AppRoutes';

import IdleTimeout from '@/components/dialogs/IdleTimeout';

function App() {
  return (
    <BrowserRouter>
      <IdleTimeout />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
