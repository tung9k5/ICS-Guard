import React, { useState, useEffect, useMemo } from 'react';
import { Unlock, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ApiAudit from '@/api/audit';
import VPagination from '@/components/VPagination';
import VNoData from '@/components/VNoData';
import VFilterPage from '@/components/VFilterPage';
import VButton from '@/components/VButton';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const BlockedIpsList = () => {
  const { t } = useTranslation();
  const [ips, setIps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [expandedId, setExpandedId] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

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

  // Khử trùng lặp IP trong danh sách
  const displayIps = useMemo(() => {
    if (!Array.isArray(ips)) return [];
    const seen = new Set();
    return ips.filter(item => {
      const key = item.ipAddress || item._id || item.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ips]);

  const handleUnblock = async (ipAddress) => {
    if (!window.confirm(`Bạn có chắc muốn mở khóa cho IP: ${ipAddress}?`)) return;

    try {
      setLoading(true);
      await ApiAudit.unblockIp(ipAddress);
      toast.success(t('audit.unblock_success'));
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
        searchPlaceholder={t('audit.search_placeholder', 'Tìm kiếm địa chỉ IP...')}
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="list-container">
        {/* --- DESKTOP TABLE VIEW (Width > 768px) --- */}
        {!isMobile && (
          <div className="table-wrapper">
            {loading ? (
              <div className="loading-state">{t('common.processing_data')}</div>
            ) : displayIps.length === 0 ? (
              <VNoData message={t('assets.list.no_data')} />
            ) : (
              <table className="v-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px', whiteSpace: 'nowrap' }}>{t('audit.blocked.table_ip')}</th>
                    <th>{t('audit.blocked.table_reason')}</th>
                    <th style={{ width: '160px', whiteSpace: 'nowrap' }}>{t('audit.blocked.table_blocked_at')}</th>
                    <th style={{ width: '120px' }}>{t('audit.blocked.table_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayIps.map(ip => (
                    <tr key={ip.id || ip._id}>
                      <td>
                        <div className="ip-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600 }}>
                          <ShieldAlert size={16} />
                          <span style={{ whiteSpace: 'nowrap' }}>{ip.ipAddress}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: '#e2e8f0' }}>
                          {ip.reason || '-'}
                        </div>
                      </td>
                      <td className="time-col" style={{ whiteSpace: 'nowrap' }}>
                        {dayjs(ip.createdAt).format('DD/MM/YYYY HH:mm')}
                      </td>
                      <td>
                        <VButton 
                          variant="outline"
                          onClick={() => handleUnblock(ip.ipAddress)}
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
        )}

        {/* --- MOBILE LIST VIEW (Width <= 768px) --- */}
        {isMobile && !loading && displayIps.length > 0 && (
          <div className="mobile-list">
            <div className="mobile-list-header">
              <div className="col-id">{t('audit.blocked.table_ip')}</div>
              <div className="col-action"></div>
            </div>
            
            {displayIps.map(ip => {
              const id = ip.id || ip._id;
              const isExpanded = expandedId === id;
              
              return (
                <div className={`mobile-card ${isExpanded ? 'expanded' : ''}`} key={id}>
                  <div className="mobile-card-header" onClick={() => toggleExpand(id)}>
                    <div className="col-id">
                      <div className="ip-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600 }}>
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
                        <div className="detail-value" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e2e8f0' }}>{ip.reason || '-'}</div>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('audit.blocked.table_blocked_at')}</span>
                        <span className="detail-value time-col">
                          {dayjs(ip.createdAt).format('DD/MM/YYYY HH:mm')}
                        </span>
                      </div>
                      <div className="detail-row" style={{ borderBottom: 'none', paddingBottom: 0, paddingTop: '16px', display: 'flex', justifyContent: 'center' }}>
                        <VButton 
                          variant="outline"
                          onClick={() => handleUnblock(ip.ipAddress)}
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

      {displayIps && displayIps.length > 0 && (
        <VPagination 
          page={page}
          perPage={perPage}
          total={total}
          dataLength={displayIps.length}
          itemName={t('audit.tab_blocked')}
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

export default BlockedIpsList;
