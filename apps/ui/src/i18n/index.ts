import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const savedLanguage = localStorage.getItem('openscad_studio_language') || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export function setLanguage(lng: string) {
  i18n.changeLanguage(lng);
  localStorage.setItem('openscad_studio_language', lng);
}

export function getLanguage(): string {
  return i18n.language;
}

export default i18n;
