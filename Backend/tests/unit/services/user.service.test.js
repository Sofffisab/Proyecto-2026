import { prisma } from '../../../src/config/database.js';
import * as userService from '../../../src/services/user.service.js';
import { users } from '../../fixtures/index.js';

jest.mock('../../../src/config/database.js');

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(users.regularUser);

      const result = await userService.getUserById(users.regularUser.id);

      expect(result).toEqual(users.regularUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: users.regularUser.id },
      });
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.getUserById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      prisma.user.findUnique.mockResolvedValue(users.regularUser);

      const result = await userService.getUserByEmail(users.regularUser.email);

      expect(result).toEqual(users.regularUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: users.regularUser.email },
      });
    });

    it('should return null if user not found by email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.getUserByEmail('nonexistent@test.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      const updated = { ...users.regularUser, ...users.updateProfilePayload };
      prisma.user.update.mockResolvedValue(updated);

      const result = await userService.updateUserProfile(
        users.regularUser.id,
        users.updateProfilePayload
      );

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: users.regularUser.id },
        data: users.updateProfilePayload,
      });
    });
  });

  describe('updateUserSettings', () => {
    it('should update user settings', async () => {
      const settings = {
        id: 'settings-001',
        userId: users.regularUser.id,
        ...users.updateSettingsPayload,
      };
      prisma.userSettings.update.mockResolvedValue(settings);

      const result = await userService.updateUserSettings(
        users.regularUser.id,
        users.updateSettingsPayload
      );

      expect(result).toEqual(settings);
      expect(prisma.userSettings.update).toHaveBeenCalled();
    });
  });

  describe('pauseAccount', () => {
    it('should pause user account', async () => {
      const paused = { ...users.regularUser, accountPaused: true };
      prisma.user.update.mockResolvedValue(paused);

      const result = await userService.pauseAccount(
        users.regularUser.id,
        'Taking a break'
      );

      expect(result.accountPaused).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('resumeAccount', () => {
    it('should resume paused account', async () => {
      const resumed = { ...users.pausedUser, accountPaused: false };
      prisma.user.update.mockResolvedValue(resumed);

      const result = await userService.resumeAccount(users.pausedUser.id);

      expect(result.accountPaused).toBe(false);
    });
  });

  describe('incrementTokenVersion', () => {
    it('should increment token version', async () => {
      const updated = { ...users.regularUser, tokenVersion: 1 };
      prisma.user.update.mockResolvedValue(updated);

      const result = await userService.incrementTokenVersion(users.regularUser.id);

      expect(result.tokenVersion).toBe(1);
    });
  });

  describe('addPoints', () => {
    it('should add points to user', async () => {
      const points = {
        id: 'points-001',
        userId: users.regularUser.id,
        totalPoints: 550,
        currentPoints: 500,
      };
      prisma.userPoints.update.mockResolvedValue(points);

      const result = await userService.addPoints(users.regularUser.id, 50);

      expect(result.totalPoints).toBe(550);
    });
  });

  describe('deductPoints', () => {
    it('should deduct points from user', async () => {
      const points = {
        id: 'points-001',
        userId: users.regularUser.id,
        totalPoints: 500,
        currentPoints: 450,
      };
      prisma.userPoints.update.mockResolvedValue(points);

      const result = await userService.deductPoints(users.regularUser.id, 50);

      expect(result.currentPoints).toBe(450);
    });

    it('should throw error if insufficient points', async () => {
      prisma.userPoints.findUnique.mockResolvedValue({
        currentPoints: 30,
      });

      await expect(userService.deductPoints(users.regularUser.id, 50))
        .rejects
        .toThrow('Insufficient points');
    });
  });
});