import React from 'react';
import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';
import { useTranslation, Trans } from 'react-i18next';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, items = [], loading = false }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const isMultiple = items.length > 1;

  return (
    <VDialog
      visible={isOpen}
      onHide={onClose}
      header={t('assets.delete_modal.title')}
      style={{ maxWidth: '400px' }}
    >
      <div style={{ textAlign: 'center', padding: '0' }}>
        <p style={{ margin: 0, color: 'var(--slate-700)', fontSize: '15px', lineHeight: '1.5' }}>
          {isMultiple ? (
            <Trans
              i18nKey="assets.delete_modal.msg_multiple"
              values={{ count: items.length }}
              components={[<strong key="0" />]}
            />
          ) : (
            <Trans
              i18nKey="assets.delete_modal.msg_single"
              values={{ name: items[0]?.name || items[0]?.id || 'này' }}
              components={[<strong key="0" />]}
            />
          )}
          <br />
          <span style={{ fontSize: '14px', color: 'var(--slate-500)', marginTop: '8px', display: 'block' }}>
            {t('assets.delete_modal.warning')}
          </span>
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', paddingTop: '12px' }}>
        <VButton variant="outline" onClick={onClose} disabled={loading} style={{ flex: '1 1 calc(50% - 6px)', minWidth: '140px', textTransform: 'uppercase' }}>
          {t('assets.delete_modal.btn_cancel')}
        </VButton>
        <VButton variant="danger" onClick={onConfirm} loading={loading} style={{ flex: '1 1 calc(50% - 6px)', minWidth: '140px', textTransform: 'uppercase' }}>
          {t('assets.delete_modal.btn_confirm')}
        </VButton>
      </div>
    </VDialog>
  );
};

export default DeleteConfirmModal;
