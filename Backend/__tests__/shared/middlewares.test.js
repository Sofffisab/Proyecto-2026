import { requireRole } from '../../shared/middlewares.js';
import { ROLES, ERROR_CODES } from '../../shared/utils.js';

describe('Middlewares de Autenticación y Roles', () => {
  it('requireRole debe bloquear a un usuario que no tiene el rol necesario', () => {
    // Simulamos una petición donde el usuario es MEMBER pero se requiere ADMIN
    const req = { user: { role: ROLES.MEMBER } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    // Creamos el middleware pidiendo que solo entren ADMINS
    const middleware = requireRole(ROLES.ADMIN);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: ERROR_CODES.FORBIDDEN
    }));
    expect(next).not.toHaveBeenCalled(); // Aseguramos que no lo dejó pasar
  });

  it('requireRole debe dejar pasar si el usuario tiene el rol correcto', () => {
    const req = { user: { role: ROLES.ADMIN } };
    const res = {};
    const next = jest.fn();

    const middleware = requireRole(ROLES.ADMIN);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1); // Lo dejó pasar exitosamente
  });
});