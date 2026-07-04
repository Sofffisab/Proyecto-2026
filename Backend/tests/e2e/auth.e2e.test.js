import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';

describe('Auth E2E', () => {
  let server;
  let authToken;
  let userId;

  beforeAll(() => {
    server = app.listen(3001);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(() => {
    authToken = null;
    userId = null;
  });

  describe('POST /auth/register', () => {
    it('crea usuario nuevo y retorna tokens', async () => {
      const response = await request(server)
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.role).toBe('USER');

      authToken = response.body.data.accessToken;
      userId = response.body.data.user.id;
    });

    it('rechaza email duplicado', async () => {
      const email = `dup-${Date.now()}@example.com`;

      await request(server)
        .post('/auth/register')
        .send({
          email,
          password: 'SecurePassword123!',
          firstName: 'First',
          lastName: 'User',
        });

      const response = await request(server)
        .post('/auth/register')
        .send({
          email,
          password: 'SecurePassword123!',
          firstName: 'Second',
          lastName: 'User',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('rechaza password débil', async () => {
      const response = await request(server)
        .post('/auth/register')
        .send({
          email: `weak-${Date.now()}@example.com`,
          password: '123',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    let testEmail;

    beforeEach(async () => {
      testEmail = `login-${Date.now()}@example.com`;
      await request(server)
        .post('/auth/register')
        .send({
          email: testEmail,
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
        });
    });

    it('retorna tokens con credenciales válidas', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      authToken = response.body.data.accessToken;
    });

    it('rechaza password incorrecto', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('rechaza email inexistente', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('genera nuevo access token con refresh token válido', async () => {
      const registerRes = await request(server)
        .post('/auth/register')
        .send({
          email: `refresh-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
        });

      const refreshToken = registerRes.body.data.refreshToken;

      const response = await request(server)
        .post('/auth/refresh-token')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('rechaza refresh token inválido', async () => {
      const response = await request(server)
        .post('/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    it('agrega token a blacklist de Redis', async () => {
      const registerRes = await request(server)
        .post('/auth/register')
        .send({
          email: `logout-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
        });

      const token = registerRes.body.data.accessToken;

      const response = await request(server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Token debe estar en blacklist ahora
      const protectedRes = await request(server)
        .get('/user/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedRes.status).toBe(401);
    });
  });
});
