import { parsePaginationParams, sanitizeString } from '../../shared/utils.js';
import { jest } from '@jest/globals';

describe('Utils', () => {
  it('parsePaginationParams debe devolver valores por defecto si no hay input', () => {
    const result = parsePaginationParams({});
    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  it('parsePaginationParams no debe permitir límites mayores a 100', () => {
    const result = parsePaginationParams({ limit: 500 });
    expect(result.limit).toBe(100);
  });

  it('sanitizeString debe limpiar etiquetas HTML peligrosas', () => {
    const result = sanitizeString('<script>alert("hola")</script> Hola');
    expect(result).toBe('scriptalert("hola")/script Hola');
  });
});