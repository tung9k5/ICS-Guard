import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import viTranslation from './locales/vi/translation.json';
import { APP_CONFIG } from '@/constants/common';

const resources = {
  [APP_CONFIG.SUPPORTED_LANGUAGES.EN]: {
    translation: enTranslation
  },
  [APP_CONFIG.SUPPORTED_LANGUAGES.VI]: {
    translation: viTranslation
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem(APP_CONFIG.LANGUAGE_KEY) || APP_CONFIG.DEFAULT_LANGUAGE,
    fallbackLng: APP_CONFIG.FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
