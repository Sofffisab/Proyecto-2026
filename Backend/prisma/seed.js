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

  // Personal badge catalog: consistency streaks, social interactions, and
  // machine usage. Achievements have no unique key in the schema, so guard
  // re-runs with a findFirst-by-name check (same pattern as the goal above).
  const achievementCatalog = [
    // Consistency — day streaks
    { name: "3 días seguidos", description: "Fuiste al gimnasio 3 días consecutivos.", category: "CONSISTENCY", metric: "STREAK_DAYS", threshold: 3 },
    { name: "7 días seguidos", description: "Una semana entera sin faltar.", category: "CONSISTENCY", metric: "STREAK_DAYS", threshold: 7 },
    { name: "30 días seguidos", description: "Un mes entero sin faltar ni un día.", category: "CONSISTENCY", metric: "STREAK_DAYS", threshold: 30 },
    // Consistency — week streaks
    { name: "4 semanas seguidas", description: "Un mes yendo al menos una vez por semana.", category: "CONSISTENCY", metric: "STREAK_WEEKS", threshold: 4 },
    { name: "12 semanas seguidas", description: "Tres meses de constancia semanal.", category: "CONSISTENCY", metric: "STREAK_WEEKS", threshold: 12 },
    // Consistency — month streaks
    { name: "3 meses seguidos", description: "Tres meses seguidos entrenando.", category: "CONSISTENCY", metric: "STREAK_MONTHS", threshold: 3 },
    { name: "6 meses seguidos", description: "Medio año de constancia.", category: "CONSISTENCY", metric: "STREAK_MONTHS", threshold: 6 },
    { name: "12 meses seguidos", description: "Un año entero de constancia.", category: "CONSISTENCY", metric: "STREAK_MONTHS", threshold: 12 },
    // Social
    { name: "Primer desafío social", description: "Completaste tu primer desafío social con otro miembro.", category: "SOCIAL", metric: "SOCIAL_INTERACTIONS", threshold: 1 },
    { name: "Socialite", description: "Completaste 10 interacciones sociales.", category: "SOCIAL", metric: "SOCIAL_INTERACTIONS", threshold: 10 },
    { name: "Alma del gimnasio", description: "Completaste 50 interacciones sociales.", category: "SOCIAL", metric: "SOCIAL_INTERACTIONS", threshold: 50 },
    // Machine usage
    { name: "Primera máquina", description: "Usaste una máquina por primera vez.", category: "MACHINE", metric: "MACHINE_USES", threshold: 1 },
    { name: "25 usos de máquina", description: "Registraste 25 usos de máquina.", category: "MACHINE", metric: "MACHINE_USES", threshold: 25 },
    { name: "100 usos de máquina", description: "Registraste 100 usos de máquina.", category: "MACHINE", metric: "MACHINE_USES", threshold: 100 },
  ];

  for (const def of achievementCatalog) {
    const existing = await prisma.achievement.findFirst({ where: { name: def.name } });
    if (!existing) {
      await prisma.achievement.create({ data: def });
    }
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