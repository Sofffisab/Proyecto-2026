import * as userService from "../services/user.service.js";
import redis from "../config/redis.js";

export async function getMe(req, res, next) {
  try {
    const user = await userService.getById(req.user.id, req.user.role, req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    // req.validatedData holds the Zod-sanitized fields (not raw req.body)
    const user = await userService.update(req.user.id, req.validatedData);

    // Invalidate cached user
    if (redis) {
      await redis.del(`user:${req.user.id}`);
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateFcmToken(req, res, next) {
  try {
    const { fcmToken } = req.validatedData;
    const user = await userService.updateFcmToken(req.user.id, fcmToken);

    if (redis) {
      await redis.del(`user:${req.user.id}`);
    }

    res.json({ success: true, data: user });
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
    const user = await userService.getById(req.params.id, req.user.role, req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
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
    const targetId = req.params.id;
    const { role } = req.validatedData;

    // Prevent accidental self-demotion
    if (targetId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role. Ask another admin.",
      });
    }

    // Demoting another admin requires explicit ?confirm=true from the client
    const target = await userService.getById(targetId, "ADMIN");
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (target.role === "ADMIN" && req.query.confirm !== "true") {
      return res.status(409).json({
        success: false,
        message:
          "Target user is an ADMIN. To change an admin's role, resend the request with ?confirm=true.",
      });
    }

    const user = await userService.updateRole(targetId, role);

    // Invalidate cache so the new role takes effect immediately
    if (redis) {
      await redis.del(`user:${targetId}`);
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req, res, next) {
  try {
    const user = await userService.deactivateUser(req.params.id);

    // Invalidate cache so deactivation takes effect immediately
    if (redis) {
      await redis.del(`user:${req.params.id}`);
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function deactivateSelf(req, res, next) {
  try {
    const user = await userService.deactivateUser(req.user.id);

    if (redis) {
      await redis.del(`user:${req.user.id}`);
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

// Self-service hard-delete (Prisma schema/service must handle cascading relations)
export async function deleteSelf(req, res, next) {
  try {
    await userService.deleteUser(req.user.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await userService.changePassword(req.user.id, req.validatedData);
    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferences(req, res, next) {
  try {
    // Always uses req.user.id, never req.params.id
    const settings = await userService.updateNotificationPreferences(
      req.user.id,
      req.validatedData
    );

    // Invalidate cached user
    if (redis) {
      await redis.del(`user:${req.user.id}`);
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}
// Creates/updates a trainer profile for a given user
export async function upsertTrainerProfile(req, res, next) {
  try {
    const targetId = req.params.id;
    const { specialty } = req.validatedData;

    // Verify the target user exists
    const target = await userService.getById(targetId, req.user.role);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const profile = await userService.upsertTrainerProfile(targetId, specialty);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}