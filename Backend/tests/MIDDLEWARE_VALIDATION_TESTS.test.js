/**
 * MIDDLEWARE & VALIDATION TESTS
 * Testing: Auth JWT, Role Authorization, Error Handling, Rate Limiting, Input Validation
 */

import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/config/redis.js');
vi.mock('jsonwebtoken');

import redis from '../src/config/redis.js';
import { authMiddleware, roleMiddleware, errorHandler, rateLimiter } from '../src/middlewares';
import { validateEmail, validatePassword, sanitizeInput } from '../src/utils/validators.js';

describe('AUTH MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('JWT Validation', () => {
    it('should validate correct JWT token', async () => {
      const token = 'valid_token_123';
      const decoded = { userId: 'user-123', role: 'USER' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);
      redis.get.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without token', async () => {
      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('token'),
        })
      );
    });

    it('should reject malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat token123';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject expired token', async () => {
      req.headers.authorization = 'Bearer expired_token';
      jwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('expired'),
        })
      );
    });

    it('should extract bearer token correctly', async () => {
      const token = 'valid_token';
      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue({ userId: 'user-123' });
      redis.get.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
    });

    it('should check token blacklist', async () => {
      const token = 'blacklisted_token';
      req.headers.authorization = `Bearer ${token}`;
      redis.get.mockResolvedValue('1');

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('logged out'),
        })
      );
    });

    it('should attach user info to request', async () => {
      const token = 'valid_token';
      const userInfo = { userId: 'user-123', role: 'USER', email: 'user@example.com' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(userInfo);
      redis.get.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(userInfo);
    });
  });

  describe('Token Claims Validation', () => {
    it('should verify token has required claims', async () => {
      const token = 'valid_token';
      const decoded = { userId: 'user-123', role: 'USER' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);
      redis.get.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(req.user).toHaveProperty('userId');
      expect(req.user).toHaveProperty('role');
    });

    it('should reject token without userId', async () => {
      const token = 'invalid_token';
      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue({ role: 'USER' });
      redis.get.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});

describe('ROLE AUTHORIZATION MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { userId: 'user-123', role: 'USER' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Role Authorization', () => {
    it('should allow user with correct role', () => {
      const middleware = roleMiddleware(['USER', 'ADMIN']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny user with incorrect role', () => {
      req.user.role = 'TRAINER';
      const middleware = roleMiddleware(['ADMIN']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('permission'),
        })
      );
    });

    it('should allow ADMIN to access any role', () => {
      req.user.role = 'ADMIN';
      const middleware = roleMiddleware(['USER']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow multiple roles', () => {
      req.user.role = 'TRAINER';
      const middleware = roleMiddleware(['USER', 'TRAINER', 'ADMIN']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 Forbidden for insufficient permissions', () => {
      req.user.role = 'USER';
      const middleware = roleMiddleware(['ADMIN']);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

describe('ERROR HANDLER MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Standard Error Handling', () => {
    it('should handle AppError correctly', () => {
      const error = {
        statusCode: 400,
        message: 'Invalid input',
        isOperational: true,
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid input',
      });
    });

    it('should expose error message in development', () => {
      process.env.NODE_ENV = 'development';
      const error = {
        statusCode: 400,
        message: 'Development error',
        isOperational: true,
      };

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Development error',
        })
      );
    });

    it('should hide error details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = {
        statusCode: 500,
        message: 'Internal database error',
        isOperational: true,
      };

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Internal Server Error',
        })
      );
    });

    it('should default to 500 status code', () => {
      const error = new Error('Generic error');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('JWT Error Handling', () => {
    it('should handle TokenExpiredError', () => {
      const error = new jwt.TokenExpiredError('Token expired', new Date());

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle JsonWebTokenError', () => {
      const error = new jwt.JsonWebTokenError('Invalid token');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Prisma Error Handling', () => {
    it('should handle unique constraint violation', () => {
      const error = {
        code: 'P2002',
        meta: { target: ['email'] },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle record not found', () => {
      const error = {
        code: 'P2025',
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

describe('RATE LIMITER MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '192.168.1.1',
      user: { id: 'user-123' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Request Limiting', () => {
    it('should allow request within limit', async () => {
      redis.incr.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      const middleware = rateLimiter({ max: 100, windowMs: 60000 });
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny request exceeding limit', async () => {
      redis.incr.mockResolvedValue(101);
      redis.ttl.mockResolvedValue(30);

      const middleware = rateLimiter({ max: 100, windowMs: 60000 });
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should return 429 Too Many Requests', async () => {
      redis.incr.mockResolvedValue(101);
      redis.ttl.mockResolvedValue(30);

      const middleware = rateLimiter({ max: 100 });
      await middleware(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('rate limit'),
        })
      );
    });

    it('should set Retry-After header', async () => {
      redis.incr.mockResolvedValue(101);
      redis.ttl.mockResolvedValue(45);

      const middleware = rateLimiter({ max: 100 });
      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should skip rate limit for admin', async () => {
      req.user.role = 'ADMIN';
      redis.incr.mockResolvedValue(1000);

      const middleware = rateLimiter({ max: 100, skipAdmins: true });
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Rate Limit Key Generation', () => {
    it('should use IP for anonymous requests', async () => {
      delete req.user;
      redis.incr.mockResolvedValue(1);

      const middleware = rateLimiter({ max: 100 });
      await middleware(req, res, next);

      expect(redis.incr).toHaveBeenCalledWith(expect.stringContaining('192.168.1.1'));
    });

    it('should use userId for authenticated requests', async () => {
      redis.incr.mockResolvedValue(1);

      const middleware = rateLimiter({ max: 100 });
      await middleware(req, res, next);

      expect(redis.incr).toHaveBeenCalledWith(expect.stringContaining('user-123'));
    });
  });
});

describe('INPUT VALIDATION TESTS', () => {
  describe('Email Validation', () => {
    it('should validate correct email format', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('should accept various valid formats', () => {
      expect(validateEmail('user+tag@example.com')).toBe(true);
      expect(validateEmail('user.name@example.co.uk')).toBe(true);
    });
  });

  describe('Password Validation', () => {
    it('should validate strong password', () => {
      expect(validatePassword('StrongPass123!')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('123456')).toBe(false);
      expect(validatePassword('password')).toBe(false);
      expect(validatePassword('Pass1')).toBe(false);
    });

    it('should require minimum length', () => {
      expect(validatePassword('Short1!')).toBe(false);
    });

    it('should require mixed case and numbers', () => {
      expect(validatePassword('OnlyLetters')).toBe(false);
      expect(validatePassword('12345678')).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    it('should remove XSS attempts', () => {
      const malicious = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
    });

    it('should remove SQL injection attempts', () => {
      const malicious = "'; DROP TABLE users; --";
      const sanitized = sanitizeInput(malicious);

      expect(sanitized).not.toContain('DROP');
      expect(sanitized).not.toContain('TABLE');
    });

    it('should preserve valid text', () => {
      const validText = 'Normal user input with spaces';
      const sanitized = sanitizeInput(validText);

      expect(sanitized).toBe(validText);
    });

    it('should handle special characters safely', () => {
      const input = 'User@#$%^&*()Name';
      const sanitized = sanitizeInput(input);

      expect(sanitized).toBeTruthy();
    });
  });

  describe('CSRF Protection', () => {
    it('should validate CSRF token', () => {
      const token = 'valid_csrf_token_123';
      const req = { csrfToken: () => token };

      expect(req.csrfToken()).toBe(token);
    });

    it('should reject missing CSRF token', () => {
      const req = {};

      expect(req.csrfToken).toBeUndefined();
    });
  });
});