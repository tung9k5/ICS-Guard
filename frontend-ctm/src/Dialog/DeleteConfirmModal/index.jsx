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
      style={{ maxWidth: '28.5714rem' }}
    >
      <div style={{ textAlign: 'center', padding: '0' }}>
        <p style={{ margin: 0, color: 'var(--slate-700)', fontSize: '1.0714rem', lineHeight: '1.5' }}>
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
          <span style={{ fontSize: '1rem', color: 'var(--slate-500)', marginTop: '0.5714rem', display: 'block' }}>
            {t('assets.delete_modal.warning')}
          </span>
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8571rem', paddingTop: '0.8571rem' }}>
        <VButton variant="outline" onClick={onClose} disabled={loading} style={{ flex: '1 1 calc(50% - 0.4286rem)', minWidth: '10rem', textTransform: 'uppercase' }}>
          {t('assets.delete_modal.btn_cancel')}
        </VButton>
        <VButton variant="danger" onClick={onConfirm} loading={loading} style={{ flex: '1 1 calc(50% - 0.4286rem)', minWidth: '10rem', textTransform: 'uppercase' }}>
          {t('assets.delete_modal.btn_confirm')}
        </VButton>
      </div>
    </VDialog>
  );
};

export default DeleteConfirmModal;
