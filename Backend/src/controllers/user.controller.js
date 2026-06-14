import * as userService from "../services/user.service.js";

export async function getMe(req, res, next) {
  try {
    const user = await userService.getById(req.user.id);
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
    const users = await userService.getAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const user = await userService.getById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function changeRole(req, res, next) {
  try {
    const user = await userService.changeRole(
      req.params.id,
      req.body.role
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req, res, next) {
  try {
    const user = await userService.deactivate(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}