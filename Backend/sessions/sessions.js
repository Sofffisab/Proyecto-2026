import { prisma } from "../prisma/prisma.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

const setupsessions = (JWT_SECRET) => {
  const login = async (req, res) => {
    const { usuarioI, mailI, contraseniaP } = req.body;
    let userData;

    try {
      if (mailI) {
        userData = await prisma.user.findUnique({
          where: { mail: mailI },
        });
      } else if (usuarioI) {
        userData = await prisma.user.findUnique({
          where: { user: usuarioI },
        });
      }

      if (!userData || !contraseniaP) {
        return res.status(401).json({ error: "Wrong data" });
      }

      const passwordMatch = await argon2.verify(userData.password, contraseniaP);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Wrong data" });
      }

      const token = jwt.sign(
        {
          userId: userData.id,
          mail: userData.mail,
          name: userData.name,
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.status(200).json({
        message: "Logged in successfully",
        token,
        photo: userData.photo
          ? `data:image/jpeg;base64,${Buffer.from(userData.photo).toString("base64")}`
          : null,
      });
    } catch (error) {
      console.error("Unsuccessful login:", error);
      res.status(500).json({
        error: "Internal Server Error",
        retry: true,
      });
    }
  };

  const signup = async (req, res) => {
    const { user, name, mail, contraseniaPrior } = req.body;
    const photoBuffer = req.file?.buffer;

    try {
      if (!user || !name || !mail || !contraseniaPrior) {
        return res.status(400).json({ error: "Required fields are missing" });
      }

      const hashedPassword = await argon2.hash(contraseniaPrior);

      const newUser = await prisma.user.create({
        data: {
          user,
          name,
          mail,
          password: hashedPassword,
          photo: photoBuffer || null,
        },
      });

      const token = jwt.sign(
        {
          userId: newUser.id,
          mail: newUser.mail,
          name: newUser.name,
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.status(201).json({
        message: "User created successfully",
        token,
        photo: newUser.photo
          ? `data:image/jpeg;base64,${Buffer.from(newUser.photo).toString("base64")}`
          : null,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({
          error: "Email or username already registered",
          retry: false,
          suggestion: "Use a different email address or username",
        });
      }
      console.error("Error signing up:", error);
      res.status(500).json({
        error: "Internal Server Error",
        details: error.message,
        retry: true,
      });
    }
  };

  const updateuserprofile = async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "No data provided in request body" });
    }

    const userId = req.personaId; // Assuming your middleware still attaches it here
    const { user, name } = req.body;

    try {
      if (!user && !name) {
        return res.status(400).json({ error: "No data provided to update" });
      }

      const updateData = {};
      if (user) updateData.user = user;
      if (name) updateData.name = name;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          user: true,
          name: true,
          mail: true,
        },
      });

      res.status(200).json({
        message: "User profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "Username already taken" });
      }
      console.error("Error updating user profile:", error);
      res.status(500).json({
        error: "Internal Server Error",
        retry: true,
      });
    }
  };

  const getcurrentuser = async (req, res) => {
    const userId = req.personaId;

    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          user: true,
          name: true,
          mail: true,
          photo: true,
        },
      });

      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }

      const userResponse = {
        ...userData,
        photo: userData.photo
          ? `data:image/jpeg;base64,${Buffer.from(userData.photo).toString("base64")}`
          : null,
      };

      res.status(200).json(userResponse);
    } catch (error) {
      console.error("Error getting current user:", error);
      res.status(500).json({
        error: "Internal Server Error",
        retry: true,
      });
    }
  };

  const deleteaccount = async (req, res) => {
    const userId = req.personaId;

    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userData) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({
        error: "Internal Server Error",
        retry: true,
      });
    }
  };

  return { login, signup, updateuserprofile, getcurrentuser, deleteaccount };
};

export default setupsessions;