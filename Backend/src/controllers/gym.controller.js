import * as gymService from "../services/gym.service.js";
import * as gymOverviewService from "../services/gymOverview.service.js";

export async function checkIn(req, res, next) {
  try {
    const session = await gymService.checkIn(req.user.id);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req, res, next) {
  try {
    const session = await gymService.checkOut(req.user.id);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function getSessionHistory(req, res, next) {
  try {
    const data = await gymService.getSessionHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSessionById(req, res, next) {
  try {
    const data = await gymService.getSessionById(req.params.id, req.user.id);
    if (!data) return res.status(404).json({ success: false, message: "Session not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function presentUsers(req, res, next) {
  try {
    const users = await gymService.getPresentUsers();
    // Members only need to know who is around (to report someone): the medical
    // data, goals and settings of the rest of the gym are for staff.
    const data =
      req.user?.role === "USER"
        ? users.map((s) => ({
            id: s.id,
            userId: s.userId,
            checkInAt: s.checkInAt,
            user: { id: s.user.id, firstName: s.user.firstName, lastName: s.user.lastName, role: s.user.role },
          }))
        : users;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function priorityAssistanceList(req, res, next) {
  try {
    const users = await gymService.getPriorityAssistanceList(req.user.id);
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function rateTrainer(req, res, next) {
  try {
    const result = await gymService.rateTrainer(
      req.params.id,
      req.user.id,
      req.validatedData.trainerId,
      req.validatedData.rating,
      req.validatedData.helped,
      req.validatedData.comment
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
// Returns the authenticated user's current session status
export async function getGymStatus(req, res, next) {
  try {
    const session = await gymService.getCurrentSession(req.user.id);
    res.json({ success: true, data: { isCheckedIn: !!session, session: session ?? null } });
  } catch (err) {
    next(err);
  }
}

// GET /gym/summary  (TRAINER, ADMIN)
export async function getTrainerSummary(req, res, next) {
  try {
    res.json({ success: true, data: await gymOverviewService.getTrainerSummary(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// GET /gym/people  (TRAINER, ADMIN)
export async function getPeopleInGym(req, res, next) {
  try {
    res.json({ success: true, data: await gymOverviewService.getPeopleInGym(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// GET /gym/people/:userId  (TRAINER, ADMIN)
export async function getPersonInGym(req, res, next) {
  try {
    res.json({ success: true, data: await gymOverviewService.getPersonInGym(req.user.id, req.params.userId) });
  } catch (err) {
    next(err);
  }
}
