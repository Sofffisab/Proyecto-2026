
/**
 * Verifica que la cuenta del usuario autenticado esté activa.
 * Debe aplicarse DESPUÉS de authenticate, ya que depende de req.user.
 * Impide que cuentas desactivadas accedan a cualquier pantalla protegida.
 */
export const requireActiveAccount = (req, res, next) => {
  if (!req.user || !req.user.isActive) {
    return res.status(403).json({
      success: false,
      message: "Account disabled",
    });
  }
  next();
};

export default requireActiveAccount;