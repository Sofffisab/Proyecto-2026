// src/i18n/locales/index.js
//
// Static registry of available translations.
// To add a new language:
//   1) Create src/i18n/locales/<code>.json with the same structure as en.json
//   2) Import it and add it here
//   3) Add its entry to src/i18n/languages.json
// Nothing else in the app needs to change.

import en from './en.json';

const translations = {
  en,
};

export default translations;
