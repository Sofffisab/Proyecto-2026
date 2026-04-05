import { prisma } from "../prisma/prisma.js";

const VALID_GENDER = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];
const VALID_GOAL = ["LOSE_WEIGHT", "BUILD_MUSCLE", "MAINTAIN", "TONE"];

const USER_DATA_SELECT = {
  age: true,
  weight: true,
  height: true,
  gender: true,
  goal: true,
  socialization: true,
  requiresTrainer: true,
  type: true,
  change: true,
};

const setupuserdata = () => {
  const getuserdata = async (req, res) => {
    try {
      const userData = await prisma.userData.findUnique({
        where: { userId: req.userId },
        select: USER_DATA_SELECT,
      });

      if (!userData) {
        return res.status(404).json({ error: "User data not found" });
      }

      res.status(200).json(userData);
    } catch (error) {
      console.error("Get user data error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const createuserdata = async (req, res) => {
    const {
      age,
      weight,
      height,
      gender,
      goal,
      socialization,
      requiresTrainer,
      type,
      change,
    } = req.body ?? {};

    if (gender && !VALID_GENDER.includes(gender)) {
      return res.status(400).json({
        error: `Invalid value for gender. Valid values: ${VALID_GENDER.join(", ")}`,
      });
    }

    if (goal && !VALID_GOAL.includes(goal)) {
      return res.status(400).json({
        error: `Invalid value for goal. Valid values: ${VALID_GOAL.join(", ")}`,
      });
    }

    if (age !== undefined && (isNaN(age) || age <= 0)) {
      return res.status(400).json({ error: "age must be a positive number" });
    }
    if (weight !== undefined && (isNaN(weight) || weight <= 0)) {
      return res.status(400).json({ error: "weight must be a positive number" });
    }
    if (height !== undefined && (isNaN(height) || height <= 0)) {
      return res.status(400).json({ error: "height must be a positive number" });
    }

    try {
      const newUserData = await prisma.userData.create({
        data: {
          userId: req.userId,
          age: age !== undefined ? Number(age) : undefined,
          weight: weight !== undefined ? Number(weight) : undefined,
          height: height !== undefined ? Number(height) : undefined,
          gender: gender ?? undefined,
          goal: goal ?? undefined,
          socialization: socialization !== undefined ? Boolean(socialization) : true,
          requiresTrainer: requiresTrainer !== undefined ? Boolean(requiresTrainer) : true,
          type: type ?? undefined,
          change: change ?? undefined,
        },
        select: USER_DATA_SELECT,
      });

      res.status(201).json({
        message: "User data created successfully",
        userData: newUserData,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "User data already exists for this user",
          retry: false,
          suggestion: "Use PUT /api/users/me/data to update existing data",
        });
      }
      console.error("Create user data error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const updateuserdata = async (req, res) => {
    const {
      age,
      weight,
      height,
      gender,
      goal,
      socialization,
      requiresTrainer,
      type,
      change,
    } = req.body ?? {};

    const hasAnyField =
      age !== undefined ||
      weight !== undefined ||
      height !== undefined ||
      gender !== undefined ||
      goal !== undefined ||
      socialization !== undefined ||
      requiresTrainer !== undefined ||
      type !== undefined ||
      change !== undefined;

    if (!hasAnyField) {
      return res.status(400).json({ error: "No data provided to update" });
    }

    if (gender && !VALID_GENDER.includes(gender)) {
      return res.status(400).json({
        error: `Invalid value for gender. Valid values: ${VALID_GENDER.join(", ")}`,
      });
    }

    if (goal && !VALID_GOAL.includes(goal)) {
      return res.status(400).json({
        error: `Invalid value for goal. Valid values: ${VALID_GOAL.join(", ")}`,
      });
    }

    if (age !== undefined && (isNaN(age) || age <= 0)) {
      return res.status(400).json({ error: "age must be a positive number" });
    }
    if (weight !== undefined && (isNaN(weight) || weight <= 0)) {
      return res.status(400).json({ error: "weight must be a positive number" });
    }
    if (height !== undefined && (isNaN(height) || height <= 0)) {
      return res.status(400).json({ error: "height must be a positive number" });
    }

    const updateData = {};
    if (age !== undefined) updateData.age = Number(age);
    if (weight !== undefined) updateData.weight = Number(weight);
    if (height !== undefined) updateData.height = Number(height);
    if (gender !== undefined) updateData.gender = gender;
    if (goal !== undefined) updateData.goal = goal;
    if (socialization !== undefined) updateData.socialization = Boolean(socialization);
    if (requiresTrainer !== undefined) updateData.requiresTrainer = Boolean(requiresTrainer);
    if (type !== undefined) updateData.type = type;
    if (change !== undefined) updateData.change = change;

    try {
      const updatedUserData = await prisma.userData.update({
        where: { userId: req.userId },
        data: updateData,
        select: USER_DATA_SELECT,
      });

      res.status(200).json({
        message: "User data updated successfully",
        userData: updatedUserData,
      });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({
          error: "User data not found",
          suggestion: "Use POST /api/users/me/data to create it first",
        });
      }
      console.error("Update user data error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  return { getuserdata, createuserdata, updateuserdata };
};

export default setupuserdata;