/**
 * DATABASE SEED SCRIPT — DEVELOPMENT ONLY
 * 
 * ⚠️  WARNING: This script seeds the database with hardcoded test users including
 *     an ADMIN account with password "admin123".
 * 
 * ⚠️  CRITICAL: This script MUST NEVER run on production databases.
 *     Always ensure NODE_ENV !== 'production' before running prisma seed.
 * 
 * Usage:
 *   - Development: npx prisma db seed (runs automatically after prisma migrate dev)
 *   - Manual: npx prisma db seed
 * 
 * To skip the seed during development:
 *   - Set "skipSeed": true in the prisma block of package.json
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gym.com" },
    update: {},
    create: {
      email: "admin@gym.com",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      isActive: true,
    },
  });

  const trainerUser = await prisma.user.upsert({
    where: { email: "trainer@gym.com" },
    update: {},
    create: {
      email: "trainer@gym.com",
      passwordHash,
      firstName: "John",
      lastName: "Trainer",
      role: "TRAINER",
      isActive: true,
      trainerProfile: {
        create: { specialties: ["STRENGTH", "REHABILITATION"] },
      },
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: "user@gym.com" },
    update: {},
    create: {
      email: "user@gym.com",
      passwordHash,
      firstName: "Test",
      lastName: "User",
      role: "USER",
      isActive: true,
    },
  });

  // Use upsert so re-running the seed doesn't fail on the unique qrToken constraint
  const machine = await prisma.machine.upsert({
    where: { qrToken: "bench-press-qr-seed-001" },
    update: {},
    create: {
      name: "Bench Press",
      // Use a stable but non-trivially-guessable token for the seed machine
      qrToken: "bench-press-qr-seed-001",
      active: true,
    },
  });

  // Only create the goal if the user has none yet
  const existingGoal = await prisma.goal.findFirst({ where: { userId: normalUser.id } });
  if (!existingGoal) {
    await prisma.goal.create({
      data: {
        userId: normalUser.id,
        type: "WEIGHT",
        action: "LOSE",
        targetValue: 80,
        currentValue: 90,
        difficulty: "MEDIUM",
      },
    });
  }

  console.log("Seed completed:", {
    admin: admin.email,
    trainer: trainerUser.email,
    user: normalUser.email,
    machine: machine.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });