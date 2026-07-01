import React, { useEffect, useState } from 'react';
import http from '@/http/clients/api';
import { Activity, ShieldAlert, Zap, RefreshCw, Cpu } from 'lucide-react';
import { io } from 'socket.io-client';
import './Dashboard.scss';

const Dashboard = () => {
  const [stats, setStats] = useState({ devices: 0, alerts: 0, incidents: 0 });
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch metrics and incident list
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch devices and incidents in parallel
      const [devicesRes, incidentsRes] = await Promise.all([
        http.get('/devices'),
        http.get('/incidents')
      ]);

      const deviceCount = Array.isArray(devicesRes) ? devicesRes.length : 50;
      const incidentList = Array.isArray(incidentsRes) ? incidentsRes : [];
      
      // Calculate alert count (summing up alert IDs linked to incidents)
      let alertCount = 0;
      incidentList.forEach(inc => {
        if (inc.alert_ids) alertCount += inc.alert_ids.length;
      });

      setStats({
        devices: deviceCount,
        alerts: alertCount || incidentList.length * 2, // fallback approximation
        incidents: incidentList.length
      });

      setIncidents(incidentList);

      // If we have an active selection, refresh its details too
      if (selectedIncident) {
        await fetchIncidentDetails(selectedIncident._id);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch timeline and detail for a specific incident
  const fetchIncidentDetails = async (id) => {
    try {
      setLoadingDetail(true);
      const res = await http.get(`/incidents/${id}`);
      if (res && res.incident) {
        setSelectedIncident(res.incident);
        setTimeline(res.timeline || []);
      }
    } catch (error) {
      console.error('Error fetching incident details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Trigger FastAPI AI-Engine Analysis
  const handleTriggerAiAnalysis = async (id) => {
    try {
      setAiLoading(true);
      await http.post(`/incidents/${id}/ai-analyze`);
      
      // AI analysis runs in background, wait a bit then refresh to see timeline update
      setTimeout(async () => {
        await fetchIncidentDetails(id);
        setAiLoading(false);
      }, 5000);
      
    } catch (error) {
      console.error('Error triggering AI analysis:', error);
      alert('Không thể kích hoạt AI Engine. Vui lòng kiểm tra dịch vụ AI Engine trên cổng 5000.');
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up Socket.io client connection to backend
    const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '');
    console.log('[Dashboard WebSocket] Connecting to:', socketUrl);
    const socket = io(socketUrl);

    socket.on('connect', () => {
      console.log('[Dashboard WebSocket] Connected successfully. ID:', socket.id);
    });

    const handleUpdate = () => {
      console.log('[Dashboard WebSocket] Received update event. Refreshing dashboard data...');
      fetchDashboardData();
    };

    socket.on('NEW_ALERT', handleUpdate);
    socket.on('NEW_INCIDENT', handleUpdate);
    socket.on('DEVICE_STATUS_CHANGED', handleUpdate);

    socket.on('disconnect', () => {
      console.log('[Dashboard WebSocket] Disconnected.');
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedIncident?._id]);

  const selectIncident = (inc) => {
    fetchIncidentDetails(inc._id);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1>ICS-Guard Operations Center (SOC)</h1>
        <div className="system-status">
          <div className="status-dot"></div>
          <span>Hệ thống hoạt động bình thường</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon-wrapper">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <h3>Thiết bị giám sát</h3>
            <p className="stat-value">{stats.devices}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="icon-wrapper alert">
            <Zap size={24} />
          </div>
          <div className="stat-info">
            <h3>Cảnh báo an ninh</h3>
            <p className="stat-value">{stats.alerts}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="icon-wrapper incident">
            <ShieldAlert size={24} />
          </div>
          <div className="stat-info">
            <h3>Sự cố cần xử lý</h3>
            <p className="stat-value">{stats.incidents}</p>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="dashboard-content-layout">
        
        {/* Left: Incident List */}
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Danh sách sự cố gần đây</h2>
            <button 
              onClick={fetchDashboardData} 
              style={{ background: 'none', border: 'none', color: '#39ff14', cursor: 'pointer', display: 'flex', gap: '5px', alignItems: 'center' }}
              title="Tải lại dữ liệu"
            >
              <RefreshCw size={16} />
              <span>Tải lại</span>
            </button>
          </div>

          <div className="incidents-table-wrapper">
            {incidents.length === 0 ? (
              <div className="empty-state">
                Chưa phát hiện sự cố an ninh nào. Hệ thống an toàn.
              </div>
            ) : (
              <table className="incidents-table">
                <thead>
                  <tr>
                    <th>Tiêu đề sự cố</th>
                    <th>Mức độ</th>
                    <th>Trạng thái</th>
                    <th>Thời gian phát hiện</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr 
                      key={inc._id}
                      onClick={() => selectIncident(inc)}
                      className={selectedIncident?._id === inc._id ? 'selected' : ''}
                    >
                      <td style={{ fontWeight: 600 }}>{inc.title}</td>
                      <td>
                        <span className={`badge severity-${inc.severity.toLowerCase()}`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td>
                        <span className={`badge status-${inc.status.toLowerCase()}`}>
                          {inc.status === 'investigating' ? 'Đang điều tra' : 'Đã phân tích'}
                        </span>
                      </td>
                      <td style={{ color: '#8b949e' }}>
                        {new Date(inc.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Incident Timeline & AI Report */}
        <div className="panel-card">
          <h2>Chi tiết & Phân tích sự cố</h2>
          
          {!selectedIncident ? (
            <div className="empty-state" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
              Chọn một sự cố từ danh sách bên trái để xem timeline và báo cáo AI.
            </div>
          ) : (
            <div className="detail-panel">
              <div className="detail-header">
                <h3>{selectedIncident.title}</h3>
                <p>{selectedIncident.description}</p>
              </div>

              {/* AI Trigger Area */}
              <div className="ai-action-area">
                <button 
                  onClick={() => handleTriggerAiAnalysis(selectedIncident._id)}
                  disabled={aiLoading}
                  className="ai-btn"
                >
                  {aiLoading ? (
                    <>
                      <div className="spinner"></div>
                      <span>AI đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Cpu size={16} />
                      <span>Kích hoạt AI Engine phân tích</span>
                    </>
                  )}
                </button>
              </div>

              {/* Timeline */}
              <div style={{ borderTop: '1px solid #2d3748', paddingTop: '20px' }}>
                <h4 style={{ margin: '0 0 15px 0', textTransform: 'uppercase', fontSize: '14px', color: '#8b949e' }}>
                  Dòng thời gian sự kiện
                </h4>
                
                {loadingDetail ? (
                  <div className="empty-state">Đang tải dữ liệu chi tiết...</div>
                ) : (
                  <div className="timeline-list">
                    {timeline.map((item) => {
                      const isAi = item.actor.toLowerCase().includes('ai');
                      return (
                        <div key={item._id} className={`timeline-item ${isAi ? 'ai-entry' : ''}`}>
                          <div className="item-meta">
                            <span className={isAi ? 'ai-actor' : 'actor'}>{item.actor}</span>
                            <span>{new Date(item.event_time).toLocaleTimeString()}</span>
                          </div>
                          <div className="item-desc">{item.description}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
