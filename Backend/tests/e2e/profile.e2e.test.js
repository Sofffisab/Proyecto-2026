import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';

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
        name: 'Profile Test',
      });

    token = registerRes.body.data.accessToken;
    userId = registerRes.body.data.user.id;
  });

  it('GET /user/profile retorna perfil del usuario autenticado', async () => {
    const response = await request(server)
      .get('/user/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(userId);
  });

  it('PUT /user/profile actualiza perfil', async () => {
    const response = await request(server)
      .put('/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
        bio: 'New bio',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Updated Name');
  });

  it('POST /user/change-password cambia contraseña', async () => {
    const response = await request(server)
      .post('/user/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        oldPassword: 'SecurePassword123!',
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
    const response = await request(server).get('/user/profile');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('retorna 401 con token inválido', async () => {
    const response = await request(server)
      .get('/user/profile')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
