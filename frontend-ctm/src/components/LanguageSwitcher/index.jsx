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
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.2857rem 0.5714rem', borderRadius: '0.2857rem', border: '0.0714rem solid var(--border-light, var(--gray-light))' }}
      >
        <img src={currentLang.img} alt={currentLang.label} style={{ width: '1.7143rem', height: '1.1429rem', objectFit: 'cover', marginRight: '0.5714rem' }} />
        <span style={{ fontSize: '1rem', fontWeight: '500' }}>{currentLang.label}</span>
      </div>
      
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.2857rem', backgroundColor: 'var(--bg-primary, var(--white-short))', border: '0.0714rem solid var(--border-light, var(--gray-light))', borderRadius: '0.2857rem', boxShadow: '0 0.1429rem 0.5714rem rgba(0,0,0,0.1)', zIndex: 100, minWidth: '8.9286rem' }}>
          <div 
            onClick={() => changeLanguage('vi')}
            style={{ display: 'flex', alignItems: 'center', padding: '0.5714rem 0.8571rem', cursor: 'pointer', backgroundColor: currentLang.code === 'vi' ? 'var(--bg-secondary, var(--apple-gray-1))' : 'transparent' }}
          >
            <img src="/image-vi.png" alt="Vietnamese" style={{ width: '1.7143rem', height: '1.1429rem', objectFit: 'cover', marginRight: '0.5714rem' }} />
            <span style={{ fontSize: '1rem' }}>Tiếng Việt</span>
          </div>
          <div 
            onClick={() => changeLanguage('en')}
            style={{ display: 'flex', alignItems: 'center', padding: '0.5714rem 0.8571rem', cursor: 'pointer', backgroundColor: currentLang.code === 'en' ? 'var(--bg-secondary, var(--apple-gray-1))' : 'transparent' }}
          >
            <img src="/image-en.png" alt="English" style={{ width: '1.7143rem', height: '1.1429rem', objectFit: 'cover', marginRight: '0.5714rem' }} />
            <span style={{ fontSize: '1rem' }}>English</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
