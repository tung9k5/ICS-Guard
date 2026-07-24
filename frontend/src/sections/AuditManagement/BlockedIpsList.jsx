import React, { useState, useEffect } from 'react';
import { Unlock, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ApiAudit from '@/api/audit';
import VPagination from '@/components/VPagination';
import VNoData from '@/components/VNoData';
import VFilterPage from '@/components/VFilterPage';
import VButton from '@/components/VButton';
import VDialog from '@/components/VDialog';
import { toast } from '@/utils/toast';
import { formatDate } from '@/utils/formatDate';
import { useExpandable } from '@/hooks/useExpandable';

const BlockedIpsList = () => {
  const { t } = useTranslation();
  const [ips, setIps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const { expandedId, toggleExpand } = useExpandable();

  // Unblock confirm dialog state (replaces window.confirm)
  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [ipToUnblock, setIpToUnblock] = useState(null);

  const fetchIps = async () => {
    try {
      setLoading(true);
      const res = await ApiAudit.getBlockedIps({
        page,
        per_page: perPage,
        search
      });
      if (res.data) {
        setIps(res.data);
        setTotal(res.pagination?.total || res.meta?.total || res.data.length);
      } else if (Array.isArray(res)) {
        setIps(res);
        setTotal(res.length);
      } else {
        setIps([]);
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
    const timer = setTimeout(() => fetchIps(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [page, perPage, search]);

  const openUnblockConfirm = (ipAddress) => {
    setIpToUnblock(ipAddress);
    setUnblockModalOpen(true);
  };

  const handleUnblock = async () => {
    if (!ipToUnblock) return;
    try {
      setLoading(true);
      await ApiAudit.unblockIp(ipToUnblock);
      toast.success(t('audit.unblock_success'));
      setUnblockModalOpen(false);
      setIpToUnblock(null);
      fetchIps();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || t('audit.unblock_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="blocked-ips-section">
      <VFilterPage 
        searchPlaceholder={t('audit.search_placeholder')}
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="list-container">
        {/* --- DESKTOP TABLE VIEW --- */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">{t('common.processing_data')}</div>
          ) : ips.length === 0 ? (
            <VNoData message={t('assets.list.no_data')} />
          ) : (
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ width: '10rem', whiteSpace: 'nowrap' }}>{t('audit.blocked.table_ip')}</th>
                  <th>{t('audit.blocked.table_reason')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('common.created_at', 'Ngày tạo')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('common.updated_at', 'Ngày cập nhật')}</th>
                  <th style={{ width: '7.8571rem' }}>{t('audit.blocked.table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {ips.map(ip => (
                  <tr key={ip.id || ip._id}>
                    <td>
                      <div className="ip-badge">
                        <ShieldAlert size={16} />
                        <span style={{ whiteSpace: 'nowrap' }}>{ip.ipAddress}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: '17.8571rem' }}>
                      <div className="reason-text truncate-text" title={ip.reason}>{ip.reason || '-'}</div>
                    </td>
                    <td className="time-col" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(ip.createdAt)}
                    </td>
                    <td className="time-col" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(ip.updatedAt)}
                    </td>
                    <td>
                      <VButton 
                        variant="outline"
                        onClick={() => openUnblockConfirm(ip.ipAddress)}
                      >
                        <Unlock size={16} />
                        {t('audit.btn_unblock')}
                      </VButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* --- MOBILE LIST VIEW --- */}
        {!loading && ips.length > 0 && (
          <div className="mobile-list">
            <div className="mobile-list-header">
              <div className="col-id">{t('audit.blocked.table_ip')}</div>
              <div className="col-action"></div>
            </div>
            
            {ips.map(ip => {
              const id = ip.id || ip._id;
              const isExpanded = expandedId === id;
              
              return (
                <div className={`mobile-card ${isExpanded ? 'expanded' : ''}`} key={id}>
                  <div className="mobile-card-header" onClick={() => toggleExpand(id)}>
                    <div className="col-id">
                      <div className="ip-badge">
                        <ShieldAlert size={16} />
                        <span style={{ whiteSpace: 'nowrap' }}>{ip.ipAddress}</span>
                      </div>
                    </div>
                    <div className="col-action">
                      {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mobile-card-body">
                      <div className="detail-row">
                        <span className="detail-label">{t('audit.blocked.table_reason')}</span>
                        <span className="detail-value">{ip.reason || '-'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                        <span className="detail-value time-col">
                          {formatDate(ip.createdAt)}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                        <span className="detail-value time-col">
                          {formatDate(ip.updatedAt)}
                        </span>
                      </div>
                      <div className="detail-row" style={{ borderBottom: 'none', paddingBottom: 0, paddingTop: '1.1429rem', display: 'flex', justifyContent: 'center' }}>
                        <VButton 
                          variant="outline"
                          onClick={() => openUnblockConfirm(ip.ipAddress)}
                          style={{ width: '100%' }}
                        >
                          <Unlock size={16} />
                          {t('audit.btn_unblock')}
                        </VButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ips && ips.length > 0 && (
        <VPagination 
          page={page}
          perPage={perPage}
          total={total}
          dataLength={ips.length}
          itemName={t('audit.tab_blocked')}
          onPageChange={(newPage) => setPage(newPage)}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
        />
      )}

      <VDialog
        visible={unblockModalOpen}
        onHide={() => { setUnblockModalOpen(false); setIpToUnblock(null); }}
        header={t('audit.unblock_confirm_title', 'Mở khóa IP')}
        style={{ maxWidth: '28.5714rem' }}
      >
        <div style={{ textAlign: 'center', padding: '0' }}>
          <p style={{ margin: 0, color: 'var(--slate-700)', fontSize: '1.0714rem', lineHeight: '1.5' }}>
            {t('audit.unblock_confirm_msg', 'Bạn có chắc muốn mở khóa cho IP')}{' '}
            <strong>{ipToUnblock}</strong>?
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.8571rem', paddingTop: '1.1429rem' }}>
          <VButton
            variant="outline"
            onClick={() => { setUnblockModalOpen(false); setIpToUnblock(null); }}
            style={{ flex: 1 }}
          >
            {t('common.cancel', 'Hủy')}
          </VButton>
          <VButton
            variant="primary"
            onClick={handleUnblock}
            loading={loading}
            style={{ flex: 1 }}
          >
            <Unlock size={16} />
            {t('audit.btn_unblock')}
          </VButton>
        </div>
      </VDialog>
    </div>
  );
};

export default BlockedIpsList;
