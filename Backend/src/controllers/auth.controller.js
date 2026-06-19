import * as authService from "../services/auth.service.js";

export async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ success: true, data: req.user });
}

export async function refreshToken(req, res, next) {
  try {
    const result = await authService.refreshToken(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    await authService.logout();
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    await authService.forgotPassword(req.body);
    res.json({ success: true, message: "If that email exists, a reset link was sent" });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body);
    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
}