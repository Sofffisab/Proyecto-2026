import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as userController from '../../../src/controllers/user.controller.js';
import { userService } from '../../../src/services/user.service.js';

vi.mock('../../../src/services/user.service.js');

describe('UserController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user-1' },
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

  it('getProfile retorna 200 con el perfil del usuario', async () => {
    const mockProfile = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    };

    userService.getUserById.mockResolvedValue(mockProfile);

    await userController.getProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockProfile,
      })
    );
  });

  it('updateProfile retorna 200 y llama a userService.updateProfile', async () => {
    req.body = { name: 'New Name' };

    const mockUpdated = {
      id: 'user-1',
      name: 'New Name',
    };

    userService.updateProfile.mockResolvedValue(mockUpdated);

    await userController.updateProfile(req, res, next);

    expect(userService.updateProfile).toHaveBeenCalledWith('user-1', req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('devuelve 500 y llama next(err) en error', async () => {
    const error = new Error('DB Error');
    userService.getUserById.mockRejectedValue(error);

    await userController.getProfile(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('changePassword valida credenciales antiguas', async () => {
    req.body = { oldPassword: 'old', newPassword: 'new' };

    userService.changePassword.mockResolvedValue({ success: true });

    await userController.changePassword(req, res, next);

    expect(userService.changePassword).toHaveBeenCalledWith(
      'user-1',
      'old',
      'new'
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
