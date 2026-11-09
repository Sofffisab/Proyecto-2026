// src/i18n/I18nContext.js
//
// Lightweight multi-language system based on per-language JSON files.
// Spanish and English are available. The person picks the language in Settings
// (user) or in the profile tab (trainer / admin); the choice is remembered on
// the device. To add another language, add it to `languages.json` and create
// its translation file in `locales/`.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setApiLanguage } from '../apiClient/client';
import languagesConfig from './languages.json';
import translations from './locales';

const AVAILABLE_LANGUAGES = languagesConfig.available;
const DEFAULT_LANGUAGE = languagesConfig.default;
const FALLBACK_LANGUAGE = 'en'; // complete reference file: used if a key is ever missing elsewhere
const STORAGE_KEY = 'app.language';

/**
 * Looks up a value inside a translations object using a dot-separated key,
 * e.g.: "user.home.title" -> translations.user.home.title
 */
function resolveKey(dict, key) {
  return key
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict);
}

/**
 * Replaces {{variable}} placeholders in a string with values from params.
 * E.g.: interpolate("Option {{number}}", { number: 1 }) -> "Option 1"
 */
function interpolate(text, params) {
  if (!params) return text;
  return Object.keys(params).reduce(
    (acc, param) => acc.replaceAll(`{{${param}}}`, String(params[param])),
    text
  );
}

const I18nContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  availableLanguages: AVAILABLE_LANGUAGES,
  t: (key) => key,
});

export function I18nProvider({ children, initialLanguage }) {
  const [language, setLanguageState] = useState(initialLanguage ?? DEFAULT_LANGUAGE);
  // Wait for the saved choice before drawing anything, so the app never flashes in the wrong language.
  const [ready, setReady] = useState(Boolean(initialLanguage));

  useEffect(() => {
    if (initialLanguage) return undefined;
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (alive && AVAILABLE_LANGUAGES.some((l) => l.code === saved)) setLanguageState(saved);
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [initialLanguage]);

  // The API client must know the language before any request goes out.
  useEffect(() => {
    setApiLanguage(language);
  }, [language]);

  const setLanguage = useCallback((code) => {
    if (!AVAILABLE_LANGUAGES.some((l) => l.code === code)) return;
    setLanguageState(code);
    AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
  }, []);

  const value = useMemo(() => {
    const dict = translations[language] || translations[DEFAULT_LANGUAGE];
    const fallbackDict = translations[FALLBACK_LANGUAGE];

    const t = (key, params) => {
      const resolved = resolveKey(dict, key) ?? resolveKey(fallbackDict, key);
      if (resolved === undefined) {
        // In development, returning the key itself helps spot missing translations.
        return key;
      }
      return interpolate(resolved, params);
    };

    return {
      language,
      setLanguage,
      availableLanguages: AVAILABLE_LANGUAGES,
      t,
    };
  }, [language, setLanguage]);

  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}

export default I18nContext;
