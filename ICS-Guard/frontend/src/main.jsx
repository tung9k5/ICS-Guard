import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.scss'
import { ToastContainer } from 'react-toastify';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <ToastContainer 
      limit={5}
      style={{ marginTop: '10px' }}
      toastStyle={{ marginBottom: '12px', borderRadius: '8px' }}
    />
    <App />
  </>,
)
