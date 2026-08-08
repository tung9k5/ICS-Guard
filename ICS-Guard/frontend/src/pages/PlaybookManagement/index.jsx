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
    <div className="playbook-page">
      <div className="playbook-header">
        <div>
          <h2>
            <Activity className="accent-icon" size={24} /> Quản Lý Playbook (Auto-Remediation)
          </h2>
          <p>Thiết lập kịch bản phản ứng tự động khi phát hiện tấn công mạng ICS/SCADA.</p>
        </div>
        <button onClick={handleCreateMock} style={{ padding: '8px 16px', background: 'var(--surface-secondary, #131d33)', color: 'var(--text-primary, #ffffff)', borderRadius: 'var(--radius-md, 6px)', border: '1px solid var(--border-primary, #27354d)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          <Plus size={16}/> Tạo Playbook Mẫu
        </button>
      </div>

      <div className="playbook-card-container">
        {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>Đang tải kịch bản tự động...</div> : (
          <table>
            <thead>
              <tr>
                <th>Tên Playbook</th>
                <th>Luật Kích Hoạt (Trigger)</th>
                <th>Hành Động (Actions)</th>
                <th>Trạng Thái</th>
                <th style={{ textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {playbooks.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #94a3b8)' }}>Chưa có Playbook nào. Bấm "Tạo Playbook Mẫu" để thêm mới.</td>
                </tr>
              ) : playbooks.map(pb => (
                <tr key={pb._id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>{pb.name}</td>
                  <td>
                    <code style={{ color: 'var(--accent-primary, #38bdf8)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{pb.trigger_rule}</code>
                  </td>
                  <td>
                    {pb.actions.map((a, i) => (
                      <span key={i} style={{ background: 'var(--surface-secondary, #131d33)', border: '1px solid var(--border-subtle, #1e293b)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', marginRight: '6px', color: 'var(--text-secondary, #cbd5e1)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {a.action_type}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span style={{ color: pb.is_active ? 'var(--status-success, #34d399)' : 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: 12 }}>
                      {pb.is_active ? <><Play size={14}/> Kích hoạt</> : <><Pause size={14}/> Tạm dừng</>}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleDelete(pb._id)} style={{ background: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)', borderRadius: '6px', padding: '6px 10px', color: 'var(--severity-critical, #ef4444)', cursor: 'pointer' }}>
                      <Trash2 size={15}/>
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
