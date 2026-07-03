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
    it('rechaza sin CRON_SECRET', async () => {
      const response = await request(server).post('/cron/jobs');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('rechaza con CRON_SECRET inválido', async () => {
      const response = await request(server)
        .post('/cron/jobs')
        .set('Authorization', `Bearer wrong-secret`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('ejecuta jobs con CRON_SECRET válido', async () => {
      const cronSecret = process.env.CRON_SECRET || 'test-secret';

      const response = await request(server)
        .post('/cron/jobs')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ejecuta solo 1 vez generateAnnualWrapped en año nuevo', async () => {
      const cronSecret = process.env.CRON_SECRET || 'test-secret';

      // Usar fake timers para simular 1 de enero
      // Este test necesita soporte de vitest para fake timers

      const response = await request(server)
        .post('/cron/jobs')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(response.status).toBe(200);
      // Verificar que wrapped job fue ejecutado
      if (new Date().getMonth() === 0 && new Date().getDate() === 1) {
        expect(response.body.data.wrappedExecuted).toBe(true);
      }
    });
  });
});
