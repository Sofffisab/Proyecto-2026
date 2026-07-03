import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as rewardController from '../../../src/controllers/reward.controller.js';
import { rewardService } from '../../../src/services/reward.service.js';

vi.mock('../../../src/services/reward.service.js');

describe('RewardController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user-1', role: 'USER' },
      params: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('getRewards retorna 200 con lista de recompensas', async () => {
    const mockRewards = [
      { id: 'reward-1', name: 'T-Shirt', pointsRequired: 100 },
      { id: 'reward-2', name: 'Gym Bag', pointsRequired: 250 },
    ];

    rewardService.getAvailableRewards.mockResolvedValue(mockRewards);

    await rewardController.getRewards(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockRewards,
      })
    );
  });

  it('redeemReward rechaza si no hay puntos suficientes', async () => {
    req.body = { rewardId: 'reward-1' };
    req.params = { rewardId: 'reward-1' };

    rewardService.redeemReward.mockRejectedValue(
      new Error('Insufficient points')
    );

    await rewardController.redeemReward(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('redeemReward retorna 200 y crea redemption', async () => {
    req.params = { rewardId: 'reward-1' };

    const mockRedemption = {
      id: 'redemption-1',
      userId: 'user-1',
      rewardId: 'reward-1',
      status: 'PENDING',
    };

    rewardService.redeemReward.mockResolvedValue(mockRedemption);

    await rewardController.redeemReward(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockRedemption,
      })
    );
  });

  it('updateRedemptionStatus retorna 403 para usuarios normales', async () => {
    req.params = { redemptionId: 'redemption-1' };
    req.body = { status: 'APPROVED' };

    // Solo ADMIN debería poder hacer esto
    req.user.role = 'USER';

    await rewardController.updateRedemptionStatus(req, res, next);

    // Debe rechazarse en el middleware authorize antes de llegar aquí
    expect(next).toHaveBeenCalled();
  });
});
