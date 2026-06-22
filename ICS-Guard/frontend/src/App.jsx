import React, { useState, useEffect } from 'react';
import { deviceService } from './services/deviceService';

function App() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        const response = await deviceService.getDevices();
        
        // Response trả về theo chuẩn format: { status: "success", data: [...] }
        if (response.status === 'success') {
          setDevices(response.data);
        } else {
          setError(response.message || 'Có lỗi xảy ra từ máy chủ');
        }
      } catch (err) {
        setError(err.message || 'Không thể kết nối đến Backend FastAPI');
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>ICS-Guard Dashboard</h1>
      <p>Trạng thái kết nối Frontend (Vite) và Backend (FastAPI)</p>

      <h2>Danh sách thiết bị từ Backend</h2>
      
      {loading && <p>Đang tải dữ liệu thiết bị...</p>}
      
      {error && (
        <div style={{ color: 'red', border: '1px solid red', padding: '10px' }}>
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {!loading && !error && devices.length === 0 && <p>Chưa có thiết bị nào.</p>}

      {!loading && !error && devices.length > 0 && (
        <ul>
          {devices.map((device) => (
            <li key={device.id} style={{ marginBottom: '10px' }}>
              <strong>{device.name}</strong> - 
              <span style={{ 
                color: device.status === 'active' ? 'green' : 'gray', 
                marginLeft: '5px',
                fontWeight: 'bold'
              }}>
                {device.status.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
