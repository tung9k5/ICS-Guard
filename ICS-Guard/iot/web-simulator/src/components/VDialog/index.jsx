import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './VDialog.scss';

const VDialog = ({ 
  visible, 
  onHide, 
  header, 
  children, 
  footer,
  style = {},
  className = ''
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && visible) {
        onHide();
      }
    };
    
    if (visible) {
      document.addEventListener('keydown', handleEscape);
      // Optional: Prevent background scrolling when dialog is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [visible, onHide]);

  if (!visible) return null;

  const handleOverlayClick = (e) => {
    // Only close if clicking exactly on the overlay, not on its children
    if (e.target.className === 'v-dialog-overlay') {
      onHide();
    }
  };

  const dialogContent = (
    <div className="v-dialog-overlay" onClick={handleOverlayClick}>
      <div className={`v-dialog-content ${className}`} style={style}>
        {header && (
          <div className="v-dialog-header">
            <h3>{header}</h3>
            <button className="v-dialog-close-btn" onClick={onHide} aria-label="Close dialog">
              <X size={20} />
            </button>
          </div>
        )}
        
        <div className="v-dialog-body">
          {children}
        </div>
        
        {footer && (
          <div className="v-dialog-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};

export default VDialog;
