import React, { useState, useEffect } from 'react';
import { Info, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ApiAudit from '@/api/audit';
import VPagination from '@/components/VPagination';
import VNoData from '@/components/VNoData';
import VFilterPage from '@/components/VFilterPage';
import VSelectFilter from '@/components/VSelectFilter';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

// Known audit actions from server (extend as needed)
const AUDIT_ACTIONS = [
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
  'CREATE', 'UPDATE', 'DELETE',
  'IP_MANUAL_UNBLOCK', 'LAUNCH_ATTACK',
];

const AuditLogsList = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await ApiAudit.getLogs({
        page,
        per_page: perPage,
        search,
        action: action !== 'all' ? action : undefined,
        order,
      });
      if (res.data) {
        setLogs(res.data);
        setTotal(res.pagination?.total || res.meta?.total || res.data.length);
      } else if (Array.isArray(res)) {
        setLogs(res);
        setTotal(res.length);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('audit.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [page, perPage, search, action, order]);

  return (
    <div className="audit-logs-section">
      <VFilterPage 
        searchPlaceholder={t('audit.search_placeholder')}
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      >
        {/* Action filter */}
        <VSelectFilter
          value={action}
          defaultValue="all"
          onChange={(val) => { setAction(val); setPage(1); }}
          placeholder={t('audit.filter_action')}
          options={AUDIT_ACTIONS.map(a => ({ value: a, label: a }))}
        />

        {/* Order filter */}
        <VSelectFilter
          value={order}
          defaultValue="desc"
          onChange={(val) => { setOrder(val); setPage(1); }}
          placeholder={t('assets.filter_order_desc')}
          options={[
            { value: 'asc', label: t('assets.filter_order_asc') },
          ]}
        />
      </VFilterPage>

      <div className="list-container">
        {/* --- DESKTOP TABLE VIEW --- */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">{t('common.processing_data')}</div>
          ) : logs.length === 0 ? (
            <VNoData message={t('assets.list.no_data')} />
          ) : (
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ width: '140px', whiteSpace: 'nowrap' }}>{t('audit.logs.table_time')}</th>
                  <th style={{ width: '130px' }}>{t('audit.logs.table_user')}</th>
                  <th style={{ width: '140px' }}>{t('audit.logs.table_action')}</th>
                  <th style={{ width: '120px' }}>{t('audit.logs.table_ip')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id || log._id}>
                    <td className="time-col">
                      {dayjs(log.createdAt).format('DD/MM/YYYY HH:mm')}
                    </td>
                    <td>
                      <div className="user-info">
                        <User size={16} />
                        <span className="truncate-text" style={{ maxWidth: '110px' }} title={log.username}>{log.username || 'System'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="action-badge">
                        {log.action}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* --- MOBILE LIST VIEW --- */}
        {!loading && logs.length > 0 && (
          <div className="mobile-list">
            <div className="mobile-list-header">
              <div className="col-id">{t('audit.logs.table_user')} & {t('audit.logs.table_action')}</div>
              <div className="col-action"></div>
            </div>
            
            {logs.map(log => {
              const id = log.id || log._id;
              const isExpanded = expandedId === id;
              
              return (
                <div className={`mobile-card ${isExpanded ? 'expanded' : ''}`} key={id}>
                  <div className="mobile-card-header" onClick={() => toggleExpand(id)}>
                    <div className="col-id">
                      <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} style={{ flexShrink: 0, color: 'var(--slate-400)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong className="truncate-text" style={{ maxWidth: '150px' }}>{log.username || 'System'}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--slate-500)' }}>{dayjs(log.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-action">
                      {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mobile-card-body">
                      <div className="detail-row">
                        <span className="detail-label">{t('audit.logs.table_action')}</span>
                        <span className="detail-value">
                          <span className="action-badge">{log.action}</span>
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('audit.logs.table_ip')}</span>
                        <span className="detail-value">{log.ipAddress || '-'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {logs && logs.length > 0 && (
        <VPagination 
          page={page}
          perPage={perPage}
          total={total}
          dataLength={logs.length}
          itemName={t('audit.tab_logs')}
          onPageChange={(newPage) => setPage(newPage)}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
        />
      )}
    </div>
  );
};

export default AuditLogsList;
