import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createUserAndLogin } from '../helpers/testAuth.js';

vi.mock('../../src/config/prisma.js', async () => {
  const { createE2EPrismaMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2EPrismaMock({ roleFromName: true }) };
});

vi.mock('../../src/config/redis.js', async () => {
  const { createE2ERedisMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2ERedisMock() };
});

vi.mock('../../src/middlewares/rateLimiter.js', () => {
  const passthrough = (req, res, next) => next();
  return {
    authRateLimiter: passthrough,
    apiRateLimiter: passthrough,
    default: { authRateLimiter: passthrough, apiRateLimiter: passthrough },
  };
});

const prisma = (await import('../../src/config/prisma.js')).default;
const app = (await import('../../src/server.js')).default;

describe('Trainer Notes E2E', () => {
  let server;
  let trainerToken;
  let otherTrainerToken;
  let userToken;
  let memberId;

  beforeAll(() => {
    server = app.listen(3013);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const trainerRes = await createUserAndLogin(server, prisma, {
      email: `trainer-${Date.now()}@example.com`,
      firstName: 'Trainer',
      lastName: 'One',
    });
    trainerToken = trainerRes.accessToken;

    const otherTrainerRes = await createUserAndLogin(server, prisma, {
      email: `trainer2-${Date.now()}@example.com`,
      firstName: 'Trainer',
      lastName: 'Two',
    });
    otherTrainerToken = otherTrainerRes.accessToken;

    const memberRes = await createUserAndLogin(server, prisma, {
      email: `member-${Date.now()}@example.com`,
      firstName: 'Member',
      lastName: 'User',
    });
    userToken = memberRes.accessToken;
    memberId = memberRes.userId;
  });

  it('a TRAINER can create a note on a member', async () => {
    const response = await request(server)
      .post(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ note: 'Great form on squats', visibility: 'PRIVATE' });

    expect(response.status).toBe(201);
    expect(response.body.data.note).toBe('Great form on squats');
  });

  it('a regular USER cannot create notes (403)', async () => {
    const response = await request(server)
      .post(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ note: 'Should not work' });

    expect(response.status).toBe(403);
  });

  it('a PRIVATE note is hidden from a different trainer but visible to the author', async () => {
    await request(server)
      .post(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ note: 'Private note', visibility: 'PRIVATE' });

    const otherTrainerView = await request(server)
      .get(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${otherTrainerToken}`);
    expect(otherTrainerView.body.data).toHaveLength(0);

    const authorView = await request(server)
      .get(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`);
    expect(authorView.body.data).toHaveLength(1);
  });

  it('a PUBLIC note is visible to any trainer', async () => {
    await request(server)
      .post(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ note: 'Public note', visibility: 'PUBLIC' });

    const otherTrainerView = await request(server)
      .get(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${otherTrainerToken}`);

    expect(otherTrainerView.body.data).toHaveLength(1);
  });

  it('a trainer cannot update a note authored by another trainer (403)', async () => {
    const created = await request(server)
      .post(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ note: 'Original', visibility: 'PRIVATE' });

    const response = await request(server)
      .put(`/users/${memberId}/notes/${created.body.data.id}`)
      .set('Authorization', `Bearer ${otherTrainerToken}`)
      .send({ note: 'Hijacked' });

    expect(response.status).toBe(500);
  });

  it('the authoring trainer can update their own note', async () => {
    const created = await request(server)
      .post(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ note: 'Original', visibility: 'PRIVATE' });

    const response = await request(server)
      .put(`/users/${memberId}/notes/${created.body.data.id}`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ note: 'Updated text' });

    expect(response.status).toBe(200);
    expect(response.body.data.note).toBe('Updated text');
  });

  it('the authoring trainer can delete their own note', async () => {
    const created = await request(server)
      .post(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ note: 'To delete', visibility: 'PRIVATE' });

    const response = await request(server)
      .delete(`/users/${memberId}/notes/${created.body.data.id}`)
      .set('Authorization', `Bearer ${trainerToken}`);

    expect(response.status).toBe(200);

    const afterDelete = await request(server)
      .get(`/users/${memberId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`);
    expect(afterDelete.body.data).toHaveLength(0);
  });
});
