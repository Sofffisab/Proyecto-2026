import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;

export async function register(data) {
  const { email, password, firstName, lastName, role } = data;

  const exists = await prisma.user.findUnique({
    where: { email },
  });

  if (exists) {
    throw new Error("Email already in use");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
    },
  });

  return user;
}

export async function login(data) {
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    throw new Error("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { user, token };
}

export async function me(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
      trainerProfile: true,
    },
  });
}