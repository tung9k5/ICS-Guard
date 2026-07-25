import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import './ActionMenu.scss';

const ActionMenu = ({ actions, direction = 'down' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="action-menu-container" ref={menuRef}>
      <button className="action-menu-trigger" onClick={toggleMenu}>
        <MoreVertical size={18} />
      </button>
      
      {isOpen && (
        <div className={`action-menu-dropdown ${direction === 'up' ? 'direction-up' : ''}`}>
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                className={`action-menu-item ${action.danger ? 'text-danger' : ''}`}
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
              >
                {Icon && <Icon size={16} />}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionMenu;
