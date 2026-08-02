import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.scss'
import { ToastContainer } from 'react-toastify';
import './i18n/config';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <ToastContainer 
      limit={5}
      style={{ marginTop: '0.7143rem' }}
      toastStyle={{ marginBottom: '0.8571rem', borderRadius: '0.5714rem' }}
    />
    <App />
  </>,
)
