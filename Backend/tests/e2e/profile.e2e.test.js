import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createUserAndLogin } from '../helpers/testAuth.js';

vi.mock('../../src/config/prisma.js', async () => {
  const { createE2EPrismaMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2EPrismaMock() };
});

vi.mock('../../src/config/redis.js', async () => {
  const { createE2ERedisMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2ERedisMock() };
});

const prisma = (await import('../../src/config/prisma.js')).default;
const app = (await import('../../src/server.js')).default;

describe('Profile E2E', () => {
  let server;
  let token;
  let userId;
  let profileEmail;

  beforeAll(() => {
    server = app.listen(3002);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    profileEmail = `profile-${Date.now()}@example.com`;
    const registerRes = await createUserAndLogin(server, prisma, {
      email: profileEmail,
      firstName: 'Profile',
      lastName: 'Test',
    });

    token = registerRes.accessToken;
    userId = registerRes.userId;
  });

  it('GET /user/profile returns the authenticated user profile', async () => {
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

  it('POST /user/change-password changes the password', async () => {
    const response = await request(server)
      .patch('/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword123!',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Try logging in with the new password
    const loginRes = await request(server)
      .post('/auth/login')
      .send({
        email: profileEmail,
        password: 'NewSecurePassword123!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();
  });

  it('retorna 401 sin token', async () => {
    const response = await request(server).get('/users/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('returns 401 with an invalid token', async () => {
    const response = await request(server)
      .get('/users/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
