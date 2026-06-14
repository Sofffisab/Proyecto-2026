import * as gymService from "../services/gym.service.js";

export async function checkIn(req, res, next) {
  try {
    const session = await gymService.checkIn(req.user.id);
    res.json(session);
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req, res, next) {
  try {
    const session = await gymService.checkOut(req.user.id);
    res.json(session);
  } catch (err) {
    next(err);
  }
}

export async function currentSession(req, res, next) {
  try {
    const session = await gymService.getCurrentSession(req.user.id);
    res.json(session);
  } catch (err) {
    next(err);
  }
}

export async function presentUsers(req, res, next) {
  try {
    const users = await gymService.getPresentUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}