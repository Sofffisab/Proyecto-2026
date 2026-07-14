// src/i18n/I18nContext.js
//
// Lightweight multi-language system based on per-language JSON files.
// Today only one language is active (English), but the architecture already
// supports multiple: to scale up you only need to add the language to
// `languages.json` and create its translation file in `locales/`.

import React, { createContext, useContext, useMemo, useState } from 'react';
import languagesConfig from './languages.json';
import translations from './locales';

const AVAILABLE_LANGUAGES = languagesConfig.available;
const DEFAULT_LANGUAGE = languagesConfig.default;

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

export function I18nProvider({ children, initialLanguage = DEFAULT_LANGUAGE }) {
  const [language, setLanguage] = useState(initialLanguage);

  const value = useMemo(() => {
    const dict = translations[language] || translations[DEFAULT_LANGUAGE];
    const fallbackDict = translations[DEFAULT_LANGUAGE];

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
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Main hook for consuming translations inside any component/screen:
 * const { t } = useTranslation();
 */
export function useTranslation() {
  return useContext(I18nContext);
}

export default I18nContext;
