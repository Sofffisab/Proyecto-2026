import { prisma } from "../prisma/prisma.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "30d"; 

const photoToBase64 = (photo) =>
  photo
    ? `data:image/jpeg;base64,${Buffer.from(photo).toString("base64")}`
    : null;

const setupsessions = (JWT_SECRET) => {
  const signToken = (user) =>
    jwt.sign(
      { userId: user.id, mail: user.mail, name: user.name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

  const login = async (req, res) => {
    const { usuarioI, mailI, contraseniaP } = req.body;

    if (!contraseniaP || (!mailI && !usuarioI)) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    try {
      const userData = await prisma.user.findUnique({
        where: mailI ? { mail: mailI } : { user: usuarioI },
      });

      if (!userData) {
        return res.status(401).json({ error: "Wrong data" });
      }

      const passwordMatch = await argon2.verify(userData.password, contraseniaP);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Wrong data" });
      }

      res.status(200).json({
        message: "Logged in successfully",
        token: signToken(userData),
        photo: photoToBase64(userData.photo),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  const signup = async (req, res) => {
    const { user, name, mail, contraseniaPrior } = req.body;
    const photoBuffer = req.file?.buffer ?? null;

    if (!user || !name || !mail || !contraseniaPrior) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    try {
      const hashedPassword = await argon2.hash(contraseniaPrior);

      const newUser = await prisma.user.create({
        data: { user, name, mail, password: hashedPassword, photo: photoBuffer },
      });

      res.status(201).json({
        message: "User created successfully",
        token: signToken(newUser),
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
        where: { id: req.personaId },
        select: { id: true, user: true, name: true, mail: true, photo: true },
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
    const { user, name } = req.body ?? {};
    const photoBuffer = req.file?.buffer;

    if (!user && !name && !photoBuffer) {
      return res.status(400).json({ error: "No data provided to update" });
    }

    const updateData = {};
    if (user) updateData.user = user;
    if (name) updateData.name = name;
    if (photoBuffer) updateData.photo = photoBuffer;

    try {
      const updatedUser = await prisma.user.update({
        where: { id: req.personaId },
        data: updateData,
        select: { id: true, user: true, name: true, mail: true },
      });

      res.status(200).json({
        message: "User profile updated successfully",
        user: updatedUser,
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
      const userData = await prisma.user.findUnique({
        where: { id: req.personaId },
      });

      if (!userData) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await prisma.user.delete({ where: { id: req.personaId } });

      res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Internal Server Error", retry: true });
    }
  };

  return { login, signup, updateuserprofile, getcurrentuser, deleteaccount };
};

export default setupsessions;