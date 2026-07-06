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
    it('accepts a valid payload', () => {
      const valid = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const invalid = {
        email: 'test@example.com',
        // missing password and name
      };

      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects an invalid email', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects a weak password', () => {
      const invalid = {
        email: 'test@example.com',
        password: '123', // too short
        name: 'Test User',
      };

      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts email and password', () => {
      const valid = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects a missing email', () => {
      const invalid = {
        password: 'SecurePass123!',
      };

      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokenSchema', () => {
    it('accepts a valid refreshToken', () => {
      const valid = {
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      };

      const result = refreshTokenSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects an empty refreshToken', () => {
      const invalid = {
        refreshToken: '',
      };

      const result = refreshTokenSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('accepts a valid email', () => {
      const valid = {
        email: 'test@example.com',
      };

      const result = forgotPasswordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid email', () => {
      const invalid = {
        email: 'not-email',
      };

      const result = forgotPasswordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('accepts a valid token and newPassword', () => {
      const valid = {
        token: 'reset-token-123',
        newPassword: 'NewSecurePass123!',
      };

      const result = resetPasswordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects a missing newPassword', () => {
      const invalid = {
        token: 'reset-token-123',
      };

      const result = resetPasswordSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
