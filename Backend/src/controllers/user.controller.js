import * as userService from "../services/user.service.js";

export async function getMe(req, res, next) {
  try {
    const user = await userService.getById(req.user.id, req.user.role);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const user = await userService.update(req.user.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function getUsers(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const users = await userService.getAll({ limit, offset });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const user = await userService.getById(req.params.id, req.user.role);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function getTrainers(req, res, next) {
  try {
    const trainers = await userService.getTrainers();
    res.json({ success: true, data: trainers });
  } catch (err) {
    next(err);
  }
}

export async function getTrainerById(req, res, next) {
  try {
    const trainer = await userService.getTrainerById(req.params.id);
    if (!trainer) return res.status(404).json({ success: false, message: "Trainer not found" });
    res.json({ success: true, data: trainer });
  } catch (err) {
    next(err);
  }
}

export async function changeRole(req, res, next) {
  try {
    const user = await userService.updateRole(req.params.id, req.body.role);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req, res, next) {
  try {
    const user = await userService.deactivateUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await userService.changePassword(req.user.id, req.body);
    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferences(req, res, next) {
  try {
    const settings = await userService.updateNotificationPreferences(req.params.id, req.body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
}