import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getItemAsync } from 'expo-secure-store';

import en from './en';
import es from './es';

const resources = {
  en: { translation: en },
  es: { translation: es },
};

const LANG_KEY = 'app_language';

// Initialize sync with default, then restore saved language asynchronously
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es',
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

getItemAsync(LANG_KEY).then(stored => {
  if (stored === 'en' || stored === 'es') {
    i18n.changeLanguage(stored);
  }
}).catch(() => {});

export default i18n;
