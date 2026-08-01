import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import incidentsApi from '@/api/incidents';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNoData from '@/components/VNoData';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import { formatDate } from '@/utils/formatDate';
import { useExpandable } from '@/hooks/useExpandable';
import IncidentForm from '@/sections/IncidentManagement/IncidentForm';
import '../index.scss';
import '../DeviceManagement/DeviceManagement.scss';

const severityColor = {
  critical: 'var(--red-500)',
  high: 'var(--orange-500)',
  medium: 'var(--yellow-500)',
  low: 'var(--green-500)',
  info: 'var(--blue-500)',
};

const statusColor = {
  open: 'var(--red-500)',
  investigating: 'var(--orange-500)',
  resolved: 'var(--green-500)',
  closed: 'var(--custom-color-14)',
};

const CustomerIncidents = () => {
  const { t } = useTranslation();

  const statusLabel = {
    open: t('customer.status.open'),
    investigating: t('customer.status.investigating'),
    resolved: t('customer.status.resolved'),
    closed: t('customer.status.closed'),
  };

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [total, setTotal] = useState(0);
  const { expandedId, toggleExpand } = useExpandable();

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await incidentsApi.getAll({ page, limit: perPage });
      setIncidents(res.data || res.incidents || []);
      setTotal(res.total || 0);
    } catch {
      toast.error(t('customer.incidents.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, [page, perPage]);

  return (
    <div className="assets-page">
      <VHeaderPage
        title={t('customer.incidents.title')}
        action={
          <div style={{ display: 'flex', gap: '0.8571rem' }}>
            <VButton onClick={() => setIsFormOpen(true)} variant="primary">
              Báo cáo sự cố
            </VButton>
            <VButton onClick={fetchIncidents} variant="outline" icon={RefreshCw}>
              {t('customer.common.refresh')}
            </VButton>
          </div>
        }
      />

      <div className="assets-content">
        {loading ? (
          <div className="device-loading">
            <span>{t('customer.common.loading')}</span>
          </div>
        ) : incidents.length === 0 ? (
          <VNoData title={t('customer.incidents.no_data')} />
        ) : (
          <div className="device-list-container">
            {/* --- DESKTOP TABLE VIEW --- */}
            <div className="device-table-wrapper">
              <table className="device-table">
                <thead>
                  <tr>
                    {[
                      t('customer.incidents.col_id', 'ID'),
                      t('customer.incidents.col_title'),
                      t('customer.incidents.col_severity'),
                      t('customer.incidents.col_status'),
                      t('customer.incidents.col_time'),
                    ].map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={incident._id}>
                      <td><strong>{incident.incident_code || `${incident._id.substring(0, 8)}...`}</strong></td>
                      <td style={{ maxWidth: '20rem' }}>
                        <div className="truncate-text" style={{ fontWeight: 500, color: 'var(--slate-900)' }} title={incident.title}>
                          {incident.title}
                        </div>
                        {incident.description && (
                          <div className="truncate-text" style={{ fontSize: '0.8571rem', color: 'var(--slate-500)', marginTop: '0.2857rem' }} title={incident.description}>
                            {incident.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.2143rem 0.7143rem',
                          borderRadius: '1.4286rem',
                          fontSize: '0.7857rem',
                          fontWeight: 600,
                          background: `${severityColor[incident.severity?.toLowerCase()] || 'var(--custom-color-14)'}22`,
                          color: severityColor[incident.severity?.toLowerCase()] || 'var(--custom-color-14)',
                          textTransform: 'uppercase',
                        }}>
                          {t(`customer.severity.${incident.severity?.toLowerCase()}`, incident.severity)}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: '0.2143rem 0.7143rem',
                          borderRadius: '1.4286rem',
                          fontSize: '0.7857rem',
                          fontWeight: 600,
                          background: `${statusColor[incident.status] || 'var(--custom-color-14)'}22`,
                          color: statusColor[incident.status] || 'var(--custom-color-14)',
                        }}>
                          {statusLabel[incident.status] || incident.status}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8571rem' }}>
                        {incident.createdAt ? formatDate(incident.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* --- MOBILE LIST VIEW --- */}
            <div className="mobile-device-list">
              <div className="mobile-list-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-id">{t('customer.incidents.col_id', 'ID')}</div>
                <div className="col-title">{t('customer.incidents.col_title')}</div>
                <div className="col-action"></div>
              </div>
              
              {incidents.map((incident) => {
                const id = incident._id;
                const isExpanded = expandedId === id;

                return (
                  <div className={`mobile-card ${isExpanded ? 'expanded' : ''}`} key={id}>
                    {/* Card Header */}
                    <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center', paddingLeft: '1rem' }}>
                      <div className="col-id" onClick={() => toggleExpand(id)}><strong>{incident.incident_code || `${id.substring(0, 8)}...`}</strong></div>
                      <div className="col-title truncate-text" onClick={() => toggleExpand(id)}>{incident.title}</div>
                      <div className="col-action" onClick={() => toggleExpand(id)}>
                        {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                      </div>
                    </div>
                    
                    {/* Card Body */}
                    {isExpanded && (
                      <div className="mobile-card-body">
                        {incident.description && (
                          <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span className="detail-label" style={{ marginBottom: '0.2857rem' }}>{t('customer.incidents.lbl_description')}</span>
                            <span className="detail-value" style={{ textAlign: 'left', lineHeight: '1.4' }}>{incident.description}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.incidents.col_severity')}</span>
                          <span className="detail-value">
                            <span style={{
                              padding: '0.2143rem 0.7143rem',
                              borderRadius: '1.4286rem',
                              fontSize: '0.7857rem',
                              fontWeight: 600,
                              background: `${severityColor[incident.severity?.toLowerCase()] || 'var(--custom-color-14)'}22`,
                              color: severityColor[incident.severity?.toLowerCase()] || 'var(--custom-color-14)',
                              textTransform: 'uppercase',
                            }}>
                              {t(`customer.severity.${incident.severity?.toLowerCase()}`, incident.severity)}
                            </span>
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.incidents.col_status')}</span>
                          <span className="detail-value">
                            <span style={{
                              padding: '0.2143rem 0.7143rem',
                              borderRadius: '1.4286rem',
                              fontSize: '0.7857rem',
                              fontWeight: 600,
                              background: `${statusColor[incident.status] || 'var(--custom-color-14)'}22`,
                              color: statusColor[incident.status] || 'var(--custom-color-14)',
                            }}>
                              {statusLabel[incident.status] || incident.status}
                            </span>
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.incidents.col_time')}</span>
                          <span className="detail-value">{incident.createdAt ? formatDate(incident.createdAt) : '—'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {total > 0 && incidents.length > 0 && (
          <VPagination
            page={page}
            perPage={perPage}
            total={total}
            dataLength={incidents.length}
            itemName={t('customer.incidents.item_name')}
            onPageChange={(newPage) => setPage(newPage)}
            onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
          />
        )}
      </div>

      {isFormOpen && (
        <IncidentForm 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => { setIsFormOpen(false); fetchIncidents(); }}
        />
      )}
    </div>
  );
};

export default CustomerIncidents;
