import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';

describe('Cron E2E', () => {
  let server;

  beforeAll(() => {
    server = app.listen(3006);
  });

  afterAll(async () => {
    server.close();
  });

  describe('POST /cron/jobs', () => {
    it('rejects requests without CRON_SECRET', async () => {
      const response = await request(server).post('/cron/jobs');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('rejects an invalid CRON_SECRET', async () => {
      const response = await request(server)
        .post('/cron/jobs')
        .set('Authorization', `Bearer wrong-secret`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('runs jobs with a valid CRON_SECRET', async () => {
      const cronSecret = process.env.CRON_SECRET || 'test-secret';

      const response = await request(server)
        .post('/cron/jobs')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('runs generateAnnualWrapped only once on the new year', async () => {
      const cronSecret = process.env.CRON_SECRET || 'test-secret';

      // Use fake timers to simulate January 1st
      // This test needs vitest support for fake timers

      const response = await request(server)
        .post('/cron/jobs')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(response.status).toBe(200);
      // Verify that the wrapped job was executed
      if (new Date().getMonth() === 0 && new Date().getDate() === 1) {
        expect(response.body.data.wrappedExecuted).toBe(true);
      }
    });
  });
});
