import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../../src/validators/auth.schemas.js';

describe('Auth Schemas', () => {
  describe('registerSchema', () => {
    it('acepta payload válido', () => {
      const valid = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rechaza campos faltantes', () => {
      const invalid = {
        email: 'test@example.com',
        // falta password y name
      };

      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rechaza email inválido', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rechaza password débil', () => {
      const invalid = {
        email: 'test@example.com',
        password: '123', // muy corta
        name: 'Test User',
      };

      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('acepta email y password', () => {
      const valid = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rechaza email faltante', () => {
      const invalid = {
        password: 'SecurePass123!',
      };

      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokenSchema', () => {
    it('acepta refreshToken válido', () => {
      const valid = {
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      };

      const result = refreshTokenSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rechaza refreshToken vacío', () => {
      const invalid = {
        refreshToken: '',
      };

      const result = refreshTokenSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('acepta email válido', () => {
      const valid = {
        email: 'test@example.com',
      };

      const result = forgotPasswordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rechaza email inválido', () => {
      const invalid = {
        email: 'not-email',
      };

      const result = forgotPasswordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('acepta token y password válidos', () => {
      const valid = {
        token: 'reset-token-123',
        password: 'NewSecurePass123!',
      };

      const result = resetPasswordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rechaza password faltante', () => {
      const invalid = {
        token: 'reset-token-123',
      };

      const result = resetPasswordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
