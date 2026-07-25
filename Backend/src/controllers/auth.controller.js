import * as authService from "../services/auth.service.js";

// Admin-only: create a member/trainer/admin account. The person receives an
// email with their account info and a link to set their own password.
export async function createUserByAdmin(req, res, next) {
  try {
    const user = await authService.createUserByAdmin(req.validatedData);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.validatedData);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const result = await authService.refreshToken(req.validatedData.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1] ?? null;
    const result = await authService.logout(token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.validatedData);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.validatedData);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}