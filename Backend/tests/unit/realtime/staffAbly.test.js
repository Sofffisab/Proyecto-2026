import { vi, it, expect } from 'vitest';
const publish = vi.fn();
const createTokenRequest = vi.fn().mockResolvedValue({ keyName: 'k' });
vi.mock('ably', () => ({
  default: {
    Realtime: class { constructor(){ this.auth = { createTokenRequest }; this.channels = { get: () => ({ publish }) }; } },
    Rest: class { constructor(){ this.auth = { createTokenRequest }; this.channels = { get: () => ({ publish }) }; } },
  },
}));
it('staff token is subscribe-only on staff:live and signals publish on it', async () => {
  process.env.ABLY_API_KEY = 'a.b:c';
  vi.resetModules();
  const m = await import('../../../src/realtime/ably.js');
  await m.createStaffTokenRequest('trainer-1');
  const args = createTokenRequest.mock.calls[0][0];
  expect(JSON.parse(args.capability)).toEqual({ 'staff:live': ['subscribe'] });
  expect(args.clientId).toBe('trainer-1');
  await m.emitStaffSignal('help', {});
  expect(publish).toHaveBeenCalledWith('help', {});
});
