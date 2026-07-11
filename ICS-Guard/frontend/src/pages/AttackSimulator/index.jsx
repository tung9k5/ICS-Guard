import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ApiAttacks from '@/api/attacks';
import AttackDevicesList from '@/sections/AttackSimulator/AttackDevicesList';
import AttackModal from '@/sections/AttackSimulator/AttackModal';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import VSelectFilter from '@/components/VSelectFilter';
import { toast } from 'react-toastify';
import './AttackSimulator.scss';

const DEVICE_TYPES = ['PLC', 'HMI', 'Switch', 'RTU', 'Sensor'];

const AttackSimulator = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attackLoading, setAttackLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deviceType, setDeviceType] = useState('all');
  const [order, setOrder] = useState('desc');

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await ApiAttacks.getDevices({
        page,
        per_page: perPage,
        search,
        type: deviceType !== 'all' ? deviceType : undefined,
        order,
      });
      if (res.data) {
        setDevices(res.data);
        setTotal(res.pagination?.total || res.meta?.total || res.data.length);
      } else if (Array.isArray(res)) {
        setDevices(res);
        setTotal(res.length);
      } else {
        setDevices([]);
        setTotal(0);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('attack.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchDevices(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [page, perPage, search, deviceType, order]);

  const handleLaunchClick = (device) => {
    setSelectedDevice(device);
    setIsModalOpen(true);
  };

  const handleConfirmAttack = async (attackType) => {
    try {
      setAttackLoading(true);
      await ApiAttacks.launchAttack(selectedDevice._id || selectedDevice.id, attackType);
      toast.success(t('attack.launch_success', { type: attackType }));
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || t('attack.launch_error'));
    } finally {
      setAttackLoading(false);
    }
  };

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('attack.page_title')}
      />

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder={t('attack.search_placeholder')}
          searchValue={search}
          onSearchChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        >
          {/* Device type filter */}
          <VSelectFilter
            value={deviceType}
            defaultValue="all"
            onChange={(val) => { setDeviceType(val); setPage(1); }}
            placeholder={t('assets.filter_type_all')}
            options={DEVICE_TYPES.map(tp => ({ value: tp, label: tp }))}
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

        <AttackDevicesList 
          devices={devices}
          loading={loading}
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          onLaunch={handleLaunchClick}
        />
      </div>

      {isModalOpen && (
        <AttackModal 
          device={selectedDevice}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmAttack}
          loading={attackLoading}
        />
      )}
    </div>
  );
};

export default AttackSimulator;
