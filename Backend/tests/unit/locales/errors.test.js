import { describe, it, expect } from 'vitest';
import { translateMessage, languageFromRequest } from '../../../src/locales/errors.js';

describe('error message translation', () => {
  it('uses Spanish only when the app asks for it', () => {
    expect(languageFromRequest({ headers: { 'accept-language': 'es' } })).toBe('es');
    expect(languageFromRequest({ headers: { 'accept-language': 'en' } })).toBe('en');
    expect(languageFromRequest({ headers: {} })).toBe('en');
    expect(languageFromRequest({})).toBe('en');
  });

  it('translates known messages and leaves unknown ones untouched', () => {
    expect(translateMessage('Another trainer is already helping this person', 'es')).toBe('Otro entrenador ya está ayudando a esta persona');
    expect(translateMessage('Something nobody listed', 'es')).toBe('Something nobody listed');
  });

  it('gives English versions of the messages written in Spanish in the code', () => {
    expect(translateMessage('Año inválido', 'en')).toBe('Invalid year');
    expect(translateMessage('Año inválido', 'es')).toBe('Año inválido');
  });

  it('keeps English messages as they are in English', () => {
    expect(translateMessage('Report not found', 'en')).toBe('Report not found');
  });
});
