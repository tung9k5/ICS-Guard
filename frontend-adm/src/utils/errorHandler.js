import { toast } from './toast';
import i18n from '@/i18n/config';

export const handleApiError = (error, fallbackMessage) => {
  if (error.response && error.response.data) {
    const apiMessage = error.response.data.message;

    if (typeof apiMessage === 'object' && apiMessage !== null) {
      const lang = i18n.language;
      const translatedMessage = apiMessage[lang] || apiMessage.en;
      if (translatedMessage) {
        toast.error(translatedMessage);
        return;
      }
    } 
    else if (typeof apiMessage === 'string' && apiMessage.trim() !== '') {
      toast.error(apiMessage);
      return;
    }
  }

  if (fallbackMessage) {
    if (typeof fallbackMessage === 'object' && fallbackMessage !== null) {
      const lang = i18n.language;
      toast.error(fallbackMessage[lang] || fallbackMessage.en);
    } else {
      toast.error(fallbackMessage);
    }
  } else {
    toast.error(i18n.t('common.toast_error_title'));
  }
};
