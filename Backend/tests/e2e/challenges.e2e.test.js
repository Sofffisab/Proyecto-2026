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
        name: 'User One',
      });
    token1 = user1Res.body.data.accessToken;
    userId1 = user1Res.body.data.user.id;

    const user2Res = await request(server)
      .post('/auth/register')
      .send({
        email: `user2-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'User Two',
      });
    token2 = user2Res.body.data.accessToken;
    userId2 = user2Res.body.data.user.id;
  });

  it('POST /challenges crea challenge nuevo', async () => {
    const response = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Summer Challenge',
        description: 'Complete 30 sessions',
        pointsReward: 500,
        durationDays: 30,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ACTIVE');
  });

  it('POST /challenges/:id/join usuario se une a challenge', async () => {
    // Create challenge
    const createRes = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Join Challenge',
        description: 'Test',
        pointsReward: 100,
        durationDays: 7,
      });

    const challengeId = createRes.body.data.id;

    // Join challenge
    const joinRes = await request(server)
      .post(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
  });

  it('rechaza join duplicado en challenge', async () => {
    const createRes = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Duplicate Join',
        description: 'Test',
        pointsReward: 100,
        durationDays: 7,
      });

    const challengeId = createRes.body.data.id;

    // Join once
    await request(server)
      .post(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    // Try join again
    const response = await request(server)
      .post(`/challenges/${challengeId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('GET /challenges/:id/leaderboard retorna ranking', async () => {
    const createRes = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Leaderboard Challenge',
        description: 'Test',
        pointsReward: 100,
        durationDays: 7,
      });

    const challengeId = createRes.body.data.id;

    const response = await request(server)
      .get(`/challenges/${challengeId}/leaderboard`)
      .set('Authorization', `Bearer ${token1}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
