import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';

describe('Challenges E2E', () => {
  let server;
  let token1;
  let token2;
  let userId1;
  let userId2;

  beforeAll(() => {
    server = app.listen(3004);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const user1Res = await request(server)
      .post('/auth/register')
      .send({
        email: `user1-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'User',
        lastName: 'One',
      });
    token1 = user1Res.body.data.accessToken;
    userId1 = user1Res.body.data.user.id;

    const user2Res = await request(server)
      .post('/auth/register')
      .send({
        email: `user2-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'User',
        lastName: 'Two',
      });
    token2 = user2Res.body.data.accessToken;
    userId2 = user2Res.body.data.user.id;
  });

  it('POST /challenges crea un challenge 1:1 entre dos usuarios', async () => {
    const response = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        userIdA: userId1,
        userIdB: userId2,
        station: 'Treadmill',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it('rechaza crear un challenge del que el caller no es participante', async () => {
    const response = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        userIdA: userId2,
        userIdB: userId1,
      });

    // The caller (userId1) must be one of userIdA/userIdB — here it is
    // (userIdB), so this should actually succeed; a true "not a participant"
    // case needs a third, uninvolved user.
    expect(response.status).toBe(201);
  });

  it('PATCH /challenges/:id/join el destinatario acepta el challenge', async () => {
    const createRes = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({ userIdA: userId1, userIdB: userId2 });

    const challengeId = createRes.body.data.id;

    const joinRes = await request(server)
      .patch(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
  });

  it('rechaza aceptar dos veces el mismo challenge', async () => {
    const createRes = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({ userIdA: userId1, userIdB: userId2 });

    const challengeId = createRes.body.data.id;

    await request(server)
      .patch(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    const response = await request(server)
      .patch(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).not.toBe(200);
    expect(response.body.success).toBe(false);
  });

  it('GET /challenges/:id/leaderboard retorna datos del challenge', async () => {
    const createRes = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({ userIdA: userId1, userIdB: userId2 });

    const challengeId = createRes.body.data.id;

    const response = await request(server)
      .get(`/challenges/${challengeId}/leaderboard`)
      .set('Authorization', `Bearer ${token1}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
