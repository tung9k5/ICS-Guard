import React, { useState, useEffect, useMemo } from 'react';
import http from '@/api/httpClient';
import { 
  FileText, User, Calendar, ShieldAlert, CheckCircle, XCircle, 
  Download, RefreshCw, Search, ArrowRightLeft, ShieldCheck
} from 'lucide-react';
import { toast } from '@/utils/toast';
import './OperationReports.scss';

// Vietnamese translation helper for operations
const getVietnameseDescription = (log) => {
  const { action, username, details, status } = log;
  const outcome = status === 'SUCCESS' ? 'thành công' : 'thất bại';
  
  let parsedDetails = {};
  if (details) {
    try {
      parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
    } catch (e) {}
  }

  const targetName = parsedDetails.name || parsedDetails.username || parsedDetails.deviceId || '';

  switch (action) {
    case 'USER_LOGIN_ATTEMPT':
      return `Yêu cầu đăng nhập tài khoản "${targetName || username}" (${outcome}).`;
    case 'USER_LOGIN_SUCCESS':
      return `Người dùng "${targetName || username}" đã đăng nhập thành công.`;
    case 'USER_LOGIN_FAILED':
      return `Yêu cầu đăng nhập tài khoản "${targetName || username}" thất bại (Lý do: ${parsedDetails.reason || 'Thông tin sai'}).`;
    case 'USER_LOGOUT':
      return `Người dùng "${username}" đã đăng xuất khỏi hệ thống.`;
    case 'USER_SETUP_ONBOARDING':
      return `Người dùng "${username}" đã hoàn tất xác thực đăng nhập lần đầu (Onboarding) (${outcome}).`;
    case 'USER_REGISTER':
      return `Người dùng mới "${targetName || username}" đã đăng ký tài khoản (${outcome}).`;
    case 'USER_GOOGLE_LOGIN_ATTEMPT':
      return `Yêu cầu đăng nhập Google SSO tài khoản "${targetName || username}" (${outcome}).`;
    case 'USER_CREATE':
      return `HR Manager/Admin đã tạo tài khoản nhân viên mới "${targetName}" (${outcome}).`;
    case 'USER_UPDATE':
      return `HR Manager/Admin đã cập nhật thông tin tài khoản "${targetName}" (${outcome}).`;
    case 'USER_DELETE':
      return `HR Manager/Admin đã xóa tài khoản nhân viên "${targetName}" (${outcome}).`;
    case 'DEVICE_CREATE':
      return `Admin đã đăng ký thiết bị mới "${targetName}" (${outcome}).`;
    case 'DEVICE_UPDATE':
      return `Admin đã cập nhật cấu hình phần mềm cho thiết bị "${targetName}" (${outcome}).`;
    case 'DEVICE_DELETE':
      return `Admin đã xóa đăng ký thiết bị "${targetName}" (${outcome}).`;
    case 'DEVICE_ISOLATE':
      return `SOC Operator đã kích hoạt cô lập mạng khẩn cấp cho thiết bị "${targetName}" (${outcome}).`;
    case 'DEVICE_UNISOLATE':
      return `SOC Operator đã phục hồi kết nối mạng cho thiết bị "${targetName}" (${outcome}).`;
    case 'DEVICE_ROLLBACK':
      return `SOC/OT Operator đã kích hoạt khôi phục logic an toàn cho PLC "${targetName}" (${outcome}).`;
    case 'IP_MANUAL_UNBLOCK':
      return `SOC Operator đã gỡ chặn thủ công cho địa chỉ IP "${parsedDetails.ipAddress || ''}" (${outcome}).`;
    case 'PROFILE_UPDATE':
      return `Người dùng đã cập nhật hồ sơ cá nhân của mình (${outcome}).`;
    default:
      // HTTP request fallbacks
      if (action.startsWith('GET')) {
        return `Đọc dữ liệu từ ${action.replace('GET ', '')} (${outcome}).`;
      } else if (action.startsWith('POST')) {
        return `Tạo mới dữ liệu tại ${action.replace('POST ', '')} (${outcome}).`;
      } else if (action.startsWith('PUT')) {
        return `Cập nhật dữ liệu tại ${action.replace('PUT ', '')} (${outcome}).`;
      } else if (action.startsWith('DELETE')) {
        return `Xóa dữ liệu tại ${action.replace('DELETE ', '')} (${outcome}).`;
      }
      return `${action} (${outcome})`;
  }
};

const OperationReports = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const fetchLogs = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await http.get('/audits/logs');
      if (Array.isArray(res)) {
        setLogs(res);
      }
    } catch (error) {
      console.error('Error fetching operational logs:', error);
      toast.error('Lỗi khi tải nhật ký vận hành.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const desc = getVietnameseDescription(log).toLowerCase();
      const matchesSearch = 
        desc.includes(search.toLowerCase()) ||
        log.username.toLowerCase().includes(search.toLowerCase()) ||
        (log.ipAddress || '').includes(search);
      
      const matchesStatus = !statusFilter || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [logs, search, statusFilter]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Không có dữ liệu nhật ký để xuất.');
      return;
    }

    try {
      // BOM to make excel display Vietnamese characters correctly
      let csvContent = '\uFEFF';
      csvContent += 'Thời gian,Người thực hiện,Hành động,Mô tả chi tiết,IP nguồn,Thiết bị sử dụng,Kết quả\r\n';

      filteredLogs.forEach(log => {
        const time = new Date(log.createdAt || log.timestamp).toLocaleString();
        const user = log.username;
        const act = log.action;
        const desc = getVietnameseDescription(log).replace(/"/g, '""'); // escape quotes
        const ip = log.ipAddress || 'N/A';
        const ua = (log.userAgent || 'N/A').replace(/"/g, '""');
        const resStatus = log.status;

        csvContent += `"${time}","${user}","${act}","${desc}","${ip}","${ua}","${resStatus}"\r\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ics_guard_operation_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Xuất file báo cáo CSV thành công!');
    } catch (err) {
      console.error('Failed to export CSV:', err);
      toast.error('Xuất file CSV thất bại.');
    }
  };

  return (
    <div className="operation-reports-page">
      <div className="reports-header">
        <div className="title-section">
          <h1>Nhật ký Vận hành Hệ thống</h1>
          <p>Xem toàn bộ kiểm toán hành vi quản trị nhân sự và tương tác thiết bị vật lý trong lưới mạng ICS.</p>
        </div>
        <button className="csv-export-btn" onClick={handleExportCSV}>
          <Download size={16} />
          <span>Tải xuống CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Tìm kiếm theo người dùng, địa chỉ IP hoặc nội dung log..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="select-filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả Kết quả</option>
            <option value="SUCCESS">Thành công (SUCCESS)</option>
            <option value="FAILED">Thất bại (FAILED)</option>
          </select>
          <button className="refresh-btn" onClick={() => fetchLogs(false)} title="Làm mới log">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Logs View */}
      {loading ? (
        <div className="reports-loading">Đang tải dữ liệu nhật ký hệ thống...</div>
      ) : (
        <div className="logs-list">
          {filteredLogs.length === 0 ? (
            <div className="empty-logs-state">Không tìm thấy bản ghi nhật ký nào.</div>
          ) : (
            <div className="table-wrapper">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Mô tả Hành động (Tiếng Việt)</th>
                    <th>IP Address</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => {
                    const isSuccess = log.status === 'SUCCESS';
                    const formattedTime = new Date(log.createdAt || log.timestamp).toLocaleString();
                    
                    return (
                      <tr key={log._id}>
                        <td className="time-col">{formattedTime}</td>
                        <td className="user-col">
                          <div className="user-info">
                            <User size={14} className="icon" />
                            <span>{log.username}</span>
                          </div>
                        </td>
                        <td className="desc-col">
                          {getVietnameseDescription(log)}
                        </td>
                        <td className="ip-col">{log.ipAddress || 'Telegram'}</td>
                        <td className="status-col">
                          <span className={`status-badge ${isSuccess ? 'success' : 'fail'}`}>
                            {isSuccess ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            <span>{isSuccess ? 'Thành công' : 'Thất bại'}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OperationReports;
