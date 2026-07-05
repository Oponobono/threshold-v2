import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getItemAsync } from 'expo-secure-store';

import en from './en';
import es from './es';

// [BOOT 00] — Module evaluation: i18n setup
// Este código se ejecuta durante la evaluación del módulo, ANTES de que React monte.
// Si i18next.init() o expo-secure-store cuelgan aquí, la app se queda en blanco
// porque el bundle JS nunca termina de cargar.
console.log('[BOOT 00a] i18n module evaluating...');

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

console.log('[BOOT 00b] i18n.init() completed');

getItemAsync(LANG_KEY).then(stored => {
  if (stored === 'en' || stored === 'es') {
    i18n.changeLanguage(stored);
  }
}).catch(() => {});

console.log('[BOOT 00c] i18n module evaluated');

export default i18n;
