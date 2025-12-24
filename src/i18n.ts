/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import ru from './locales/ru.json'

const resources = {
  en: { translation: en },
  ru: { translation: ru }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],
    
    detection: {
      // Language detection order
      order: ['localStorage', 'navigator'],
      // localStorage key
      lookupLocalStorage: 'language',
      // Cache user's choice
      caches: ['localStorage']
    },
    
    interpolation: {
      escapeValue: false // React already escapes
    }
  })

export default i18n
