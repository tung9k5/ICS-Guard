import React, { useState, useEffect } from 'react';
import http from '@/api/httpClient';
import { toast } from '@/utils/toast';
import { Activity, Trash2, Plus, Play, Pause, Save, ShieldCheck } from 'lucide-react';
import './Playbook.scss';

const PlaybookManagement = () => {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPlaybooks = async () => {
    try {
      const res = await http.get('/playbooks');
      setPlaybooks(res.data || res);
    } catch (e) {
      toast.error('Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa Playbook này?')) return;
    try {
      await http.delete(`/playbooks/${id}`);
      toast.success('Xóa playbook thành công');
      fetchPlaybooks();
    } catch (e) {
      toast.error('Lỗi khi xóa playbook');
    }
  };

  const handleCreateMock = async () => {
    try {
      const payload = {
        name: 'Auto Isolate Infected PLC',
        description: 'Tự động cô lập khi phát hiện bất thường AI DDoS',
        trigger_rule: 'AI_DETECTED_DDOS',
        actions: [{ action_type: 'isolate_device', params: {} }]
      };
      await http.post('/playbooks', payload);
      toast.success('Tạo Playbook mẫu thành công');
      fetchPlaybooks();
    } catch (e) {
      toast.error('Lỗi tạo Playbook');
    }
  };

  return (
    <div className="playbook-page" style={{ padding: '24px', color: '#cbd5e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity color="#3b82f6" /> Quản Lý Playbook (Auto-Remediation)
          </h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8' }}>Thiết lập kịch bản phản ứng tự động khi phát hiện tấn công mạng ICS.</p>
        </div>
        <button onClick={handleCreateMock} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: '4px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Plus size={16}/> Tạo Playbook Mẫu
        </button>
      </div>

      <div style={{ background: '#1e293b', borderRadius: '8px', overflow: 'hidden', padding: '20px' }}>
        {loading ? <p>Đang tải...</p> : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '12px' }}>Tên Playbook</th>
                <th style={{ padding: '12px' }}>Luật Kích Hoạt (Trigger)</th>
                <th style={{ padding: '12px' }}>Hành Động (Actions)</th>
                <th style={{ padding: '12px' }}>Trạng Thái</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {playbooks.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Chưa có Playbook nào. Bấm "Tạo Playbook Mẫu" để thêm mới.</td>
                </tr>
              ) : playbooks.map(pb => (
                <tr key={pb._id} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'white' }}>{pb.name}</td>
                  <td style={{ padding: '12px', color: '#f59e0b', fontFamily: 'monospace' }}>{pb.trigger_rule}</td>
                  <td style={{ padding: '12px' }}>
                    {pb.actions.map((a, i) => (
                      <span key={i} style={{ background: '#334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', marginRight: '4px' }}>
                        {a.action_type}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ color: pb.is_active ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {pb.is_active ? <><Play size={14}/> Kích hoạt</> : <><Pause size={14}/> Tạm dừng</>}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(pb._id)} style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px', padding: '6px', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
export default PlaybookManagement;
