import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';

const AttackModal = ({ device, onClose, onConfirm, loading }) => {
  const { t } = useTranslation();
  
  const ATTACK_TYPES = [
    { id: 'dos', label: 'Denial of Service (DoS)', description: t('attack.modal.dos_desc') },
    { id: 'mitm', label: 'Man in the Middle', description: t('attack.modal.mitm_desc') },
    { id: 'fuzzing', label: 'Fuzzing Attack', description: t('attack.modal.fuzzing_desc') }
  ];

  const [selectedAttack, setSelectedAttack] = useState(ATTACK_TYPES[0].id);

  if (!device) return null;

  return (
    <VDialog
      isOpen={true}
      onClose={onClose}
      title={t('attack.modal.title')}
      maxWidth="500px"
    >
      <div className="attack-modal-content">
        <div className="target-info">
          <p><strong>{t('attack.modal.target')}:</strong> {device.name} ({device.ipAddress})</p>
          <p><strong>{t('attack.list.table_type')}:</strong> {device.type}</p>
        </div>

        <div className="attack-options">
          <label className="section-label">{t('attack.modal.select_type')}:</label>
          <div className="options-grid">
            {ATTACK_TYPES.map(attack => (
              <div 
                key={attack.id}
                className={`attack-card ${selectedAttack === attack.id ? 'selected' : ''}`}
                onClick={() => setSelectedAttack(attack.id)}
              >
                <div className="radio-circle">
                  <div className="inner-dot"></div>
                </div>
                <div className="attack-details">
                  <h4>{attack.label}</h4>
                  <p>{attack.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <VButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('attack.modal.btn_cancel')}
          </VButton>
          <VButton 
            variant="danger" 
            onClick={() => onConfirm(selectedAttack)} 
            disabled={loading}
            loading={loading}
          >
            {t('attack.modal.btn_launch')}
          </VButton>
        </div>
      </div>
    </VDialog>
  );
};

export default AttackModal;
