import { prisma } from "../prisma/prisma.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const photoToBase64 = (photo) =>
  photo
    ? `data:image/jpeg;base64,${Buffer.from(photo).toString("base64")}`
    : null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// FCM token: ~150+ chars, alphanumeric + hyphen/underscore
// APNs token: 64 hex chars
const PUSH_TOKEN_REGEX = /^([a-zA-Z0-9_-]{140,}|[a-fA-F0-9]{64})$/;

const validateEmail = (email) => EMAIL_REGEX.test(email);
const validatePassword = (password) => password && password.length >= 8;
const validateUsername = (username) => username && username.length >= 3;
const validateName = (name) => name && name.length >= 2;
const validatePushToken = (pushToken) => PUSH_TOKEN_REGEX.test(pushToken);

const setupsessions = (JWT_SECRET) => {
  const signAccessToken = (user) =>
    jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

  const signRefreshToken = (user) =>
    jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

  const login = async (req, res) => {
    const { username, email, password } = req.body;

    if (!password || (!email && !username)) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    try {
      const userData = await prisma.user.findUnique({
        where: email ? { email: email } : { username: username },
      });

      if (!userData) {
        return res.status(401).json({ error: "Wrong data" });
      }

      const passwordMatch = await argon2.verify(userData.password, password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Wrong data" });
      }

      res.status(200).json({
        message: "Logged in successfully",
        accessToken: signAccessToken(userData),
        refreshToken: signRefreshToken(userData),
        photo: photoToBase64(userData.photo),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const signup = async (req, res) => {
    const { username, name, email, password } = req.body;
    const photoBuffer = req.file?.buffer ?? null;

    if (!username || !name || !email || !password) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }

    if (!validateName(name)) {
      return res.status(400).json({ error: "Name must be at least 2 characters" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    try {
      const hashedPassword = await argon2.hash(password);

      const newUser = await prisma.user.create({
        data: { username, name, email, password: hashedPassword, photo: photoBuffer },
      });

      res.status(201).json({
        message: "User created successfully",
        accessToken: signAccessToken(newUser),
        refreshToken: signRefreshToken(newUser),
        photo: photoToBase64(newUser.photo),
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "Email or username already registered",
          retry: false,
          suggestion: "Use a different email address or username",
        });
      }
      console.error("Signup error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const getcurrentuser = async (req, res) => {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, username: true, name: true, email: true, photo: true, pushToken: true, createdAt: true, updatedAt: true },
      });

      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({ ...userData, photo: photoToBase64(userData.photo) });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const updateuserprofile = async (req, res) => {
    const { username, name } = req.body ?? {};
    const photoBuffer = req.file?.buffer;

    if (!username && !name && !photoBuffer) {
      return res.status(400).json({ error: "No data provided to update" });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (name) updateData.name = name;
    if (photoBuffer) updateData.photo = photoBuffer;

    try {
      const updatedUser = await prisma.user.update({
        where: { id: req.userId },
        data: updateData,
        select: { id: true, username: true, name: true, email: true, photo: true, createdAt: true, updatedAt: true },
      });

      res.status(200).json({
        message: "User profile updated successfully",
        user: { ...updatedUser, photo: photoToBase64(updatedUser.photo) },
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "Username already taken" });
      }
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const deleteaccount = async (req, res) => {
    try {
      await prisma.user.delete({ where: { id: req.userId } });

      res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const refreshtoken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      const userData = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, name: true, email: true, photo: true, pushToken: true, createdAt: true, updatedAt: true },
      });

      if (!userData) {
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      res.status(200).json({
        accessToken: signAccessToken(userData),
        refreshToken: signRefreshToken(userData),
        user: { ...userData, photo: photoToBase64(userData.photo) },
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(401).json({ error: "Invalid or expired refresh token" });
    }
  };

  const updatepushtoken = async (req, res) => {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ error: "Push token required" });
    }

    if (!validatePushToken(pushToken)) {
      return res.status(400).json({ error: "Invalid push token format (must be FCM or APNs token)" });
    }

    try {
      await prisma.user.update({
        where: { id: req.userId },
        data: { pushToken },
      });

      res.status(200).json({ message: "Push token updated successfully" });
    } catch (error) {
      console.error("Update push token error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  return { login, signup, refreshtoken, updateuserprofile, getcurrentuser, deleteaccount, updatepushtoken };
};

export default setupsessions;