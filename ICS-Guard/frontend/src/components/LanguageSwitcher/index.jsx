import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
    setIsOpen(false);
  };

  const currentLang = i18n.language === 'vi' 
    ? { code: 'vi', label: 'Tiếng Việt', img: '/image-vi.png' }
    : { code: 'en', label: 'English', img: '/image-en.png' };

  return (
    <div className="language-switcher-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-light, var(--gray-light))' }}
      >
        <img src={currentLang.img} alt={currentLang.label} style={{ width: '24px', height: '16px', objectFit: 'cover', marginRight: '8px' }} />
        <span style={{ fontSize: '14px', fontWeight: '500' }}>{currentLang.label}</span>
      </div>
      
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary, var(--white-short))', border: '1px solid var(--border-light, var(--gray-light))', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '125px' }}>
          <div 
            onClick={() => changeLanguage('vi')}
            style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', backgroundColor: currentLang.code === 'vi' ? 'var(--bg-secondary, var(--apple-gray-1))' : 'transparent' }}
          >
            <img src="/image-vi.png" alt="Vietnamese" style={{ width: '24px', height: '16px', objectFit: 'cover', marginRight: '8px' }} />
            <span style={{ fontSize: '14px' }}>Tiếng Việt</span>
          </div>
          <div 
            onClick={() => changeLanguage('en')}
            style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', backgroundColor: currentLang.code === 'en' ? 'var(--bg-secondary, var(--apple-gray-1))' : 'transparent' }}
          >
            <img src="/image-en.png" alt="English" style={{ width: '24px', height: '16px', objectFit: 'cover', marginRight: '8px' }} />
            <span style={{ fontSize: '14px' }}>English</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
