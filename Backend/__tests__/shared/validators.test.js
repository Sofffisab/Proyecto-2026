import { loginSchema, registerSchema } from '../../shared/validators.js';
import { jest } from '@jest/globals';

describe('Validadores Zod', () => {
  it('debe aceptar un login con datos correctos', () => {
    const result = loginSchema.safeParse({
      email: 'test@gym.com',
      password: 'Password123'
    });
    expect(result.success).toBe(true);
  });

  it('debe rechazar un email inválido o contraseña corta', () => {
    const result = loginSchema.safeParse({
      email: 'no-es-un-email',
      password: '123'
    });
    expect(result.success).toBe(false);
    expect(result.error.errors.length).toBeGreaterThan(0);
  });

  it('debe rechazar registro sin contraseña segura', () => {
    const result = registerSchema.safeParse({
      email: 'test@gym.com',
      password: 'sinmayusculas',
      fullName: 'Juan Perez',
      username: 'juanp'
    });
    expect(result.success).toBe(false);
  });
});