import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// rotateMachineQRCodes (src/jobs/qr.job.js) delegates entirely to
// regenerateAllMachineQRCodes (already unit-tested in qr.job.test.js).
// Here we only care about the HTTP wiring in routes/index.js: cronAuth +
// the try/catch/next around the job, so we mock the service it depends on
// the same way qr.job.test.js does.
vi.mock('../../src/services/verification.service.js', () => ({
  regenerateAllMachineQRCodes: vi.fn(),
}));

import app from '../../src/server.js';
import { regenerateAllMachineQRCodes } from '../../src/services/verification.service.js';

describe('Cron QR Rotate E2E', () => {
  let server;

  beforeAll(() => {
    server = app.listen(3007);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /cron/qr-rotate', () => {
    it('rejects requests without CRON_SECRET', async () => {
      const response = await request(server).get('/api/v1/cron/qr-rotate');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(regenerateAllMachineQRCodes).not.toHaveBeenCalled();
    });

    it('rejects an invalid CRON_SECRET', async () => {
      const response = await request(server)
        .get('/api/v1/cron/qr-rotate')
        .set('Authorization', 'Bearer wrong-secret');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(regenerateAllMachineQRCodes).not.toHaveBeenCalled();
    });

    it('rotates QR codes and returns 200 with a valid CRON_SECRET', async () => {
      regenerateAllMachineQRCodes.mockResolvedValue({ regenerated: 5 });
      const cronSecret = process.env.CRON_SECRET;

      const response = await request(server)
        .get('/api/v1/cron/qr-rotate')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(regenerateAllMachineQRCodes).toHaveBeenCalledTimes(1);
    });

    it('propagates a job failure to the error handler as a 500', async () => {
      regenerateAllMachineQRCodes.mockRejectedValue(new Error('DB unavailable'));
      const cronSecret = process.env.CRON_SECRET;

      const response = await request(server)
        .get('/api/v1/cron/qr-rotate')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /cron/qr-rotate', () => {
    it('rejects requests without CRON_SECRET', async () => {
      const response = await request(server).post('/api/v1/cron/qr-rotate');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(regenerateAllMachineQRCodes).not.toHaveBeenCalled();
    });

    it('rotates QR codes and returns 200 with a valid CRON_SECRET', async () => {
      regenerateAllMachineQRCodes.mockResolvedValue({ regenerated: 0 });
      const cronSecret = process.env.CRON_SECRET;

      const response = await request(server)
        .post('/api/v1/cron/qr-rotate')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(regenerateAllMachineQRCodes).toHaveBeenCalledTimes(1);
    });
  });
});
