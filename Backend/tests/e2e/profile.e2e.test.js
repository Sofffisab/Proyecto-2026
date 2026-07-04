import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/config/prisma.js', async () => {
  const { createE2EPrismaMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2EPrismaMock() };
});

vi.mock('../../src/config/redis.js', async () => {
  const { createE2ERedisMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2ERedisMock() };
});

const app = (await import('../../src/server.js')).default;

describe('Profile E2E', () => {
  let server;
  let token;
  let userId;

  beforeAll(() => {
    server = app.listen(3002);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const registerRes = await request(server)
      .post('/auth/register')
      .send({
        email: `profile-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Profile',
        lastName: 'Test',
      });

    token = registerRes.body.data.accessToken;
    userId = registerRes.body.data.user.id;
  });

  it('GET /user/profile retorna perfil del usuario autenticado', async () => {
    const response = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(userId);
  });

  it('PUT /user/profile actualiza perfil', async () => {
    const response = await request(server)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'New bio',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.firstName).toBe('Updated');
  });

  it('POST /user/change-password cambia contraseña', async () => {
    const response = await request(server)
      .patch('/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword123!',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Intenta login con contraseña nueva
    const loginRes = await request(server)
      .post('/auth/login')
      .send({
        email: `profile-${Date.now()}@example.com`,
        password: 'NewSecurePassword123!',
      });

    // Nota: this test assumes email was stored, adjust as needed
  });

  it('retorna 401 sin token', async () => {
    const response = await request(server).get('/users/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('retorna 401 con token inválido', async () => {
    const response = await request(server)
      .get('/users/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
