import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Clock, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import incidentsApi from '@/api/incidents';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNodata from '@/components/VNodata';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';

const statusColor = { open: '#ef4444', investigating: '#f97316', resolved: '#22c55e', closed: '#6b7280' };

const CustomerIncidents = () => {
  const { t } = useTranslation();
  const statusLabel = { open: t('customer.status.open', 'Đang mở'), investigating: t('customer.status.investigating', 'Điều tra'), resolved: t('customer.status.resolved', 'Đã xử lý'), closed: t('customer.status.closed', 'Đóng') };

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await incidentsApi.getAll({ page, limit: perPage });
      setIncidents(res.data || res.incidents || []);
      setTotal(res.total || 0);
    } catch {
      toast.error(t('customer.incidents.fetch_error', 'Không thể tải danh sách sự cố'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, [page, perPage]);

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('customer.incidents.title', 'Sự cố')}
        action={
          <VButton onClick={fetchIncidents} variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={15} /> {t('customer.common.refresh', 'Làm mới')}
          </VButton>
        }
      />

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* List */}
        <div style={{ flex: selected ? '0 0 55%' : '1' }}>
          <div style={{ background: 'var(--white)', borderRadius: '12px', border: '1px solid var(--slate-200)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--slate-500)' }}>{t('customer.common.loading', 'Đang tải...')}</div>
            ) : incidents.length === 0 ? (
              <VNodata title={t('customer.incidents.no_data', 'Không có sự cố nào')} />
            ) : incidents.map((incident, i) => (
              <div
                key={incident._id}
                onClick={() => setSelected(incident)}
                style={{
                  padding: '16px 20px',
                  borderBottom: i < incidents.length - 1 ? '1px solid var(--slate-200)' : 'none',
                  cursor: 'pointer',
                  background: selected?._id === incident._id ? 'var(--slate-50)' : 'var(--white)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--slate-50)'}
                onMouseLeave={e => e.currentTarget.style.background = selected?._id === incident._id ? 'var(--slate-50)' : 'var(--white)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: 'var(--slate-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incident.title}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={11} />
                      {incident.createdAt ? new Date(incident.createdAt).toLocaleString('vi-VN') : '—'}
                    </p>
                  </div>
                  <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: `${statusColor[incident.status] || '#6b7280'}22`, color: statusColor[incident.status] || '#6b7280' }}>
                    {statusLabel[incident.status] || incident.status}
                  </span>
                </div>
              </div>
            ))}

            {total > 0 && incidents.length > 0 && (
              <div style={{ borderTop: '1px solid var(--slate-200)', background: 'var(--slate-50)' }}>
                <VPagination 
                  page={page}
                  perPage={perPage}
                  total={total}
                  dataLength={incidents.length}
                  itemName={t('customer.incidents.item_name', 'sự cố')}
                  onPageChange={(newPage) => setPage(newPage)}
                  onPerPageChange={(newPerPage) => {
                    setPerPage(newPerPage);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ flex: '0 0 42%', background: 'var(--white)', borderRadius: '12px', border: '1px solid var(--slate-200)', padding: '24px', alignSelf: 'flex-start', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--slate-900)' }}>{t('customer.incidents.detail_title', 'Chi tiết sự cố')}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--slate-500)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--slate-500)', margin: '0 0 4px' }}>{t('customer.incidents.lbl_title', 'Tiêu đề')}</p>
              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--slate-900)', margin: 0 }}>{selected.title}</p>
            </div>
            {selected.description && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate-500)', margin: '0 0 4px' }}>{t('customer.incidents.lbl_description', 'Mô tả')}</p>
                <p style={{ fontSize: '14px', color: 'var(--slate-900)', margin: 0, lineHeight: '1.5' }}>{selected.description}</p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--slate-50)', padding: '16px', borderRadius: '8px' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--slate-500)', margin: '0 0 6px' }}>{t('customer.incidents.lbl_status', 'Trạng thái')}</p>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: `${statusColor[selected.status] || '#6b7280'}22`, color: statusColor[selected.status] || '#6b7280' }}>{statusLabel[selected.status] || selected.status}</span>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--slate-500)', margin: '0 0 6px' }}>{t('customer.incidents.lbl_created_at', 'Tạo lúc')}</p>
                <p style={{ fontSize: '13px', color: 'var(--slate-900)', margin: 0, fontWeight: '500' }}>{selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : '—'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerIncidents;
