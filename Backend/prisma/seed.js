// Development-only seed script. Creates hardcoded test users (admin password:
// "admin123"). Must never run against production — check NODE_ENV first.
// Run: npx prisma db seed. Skip via "skipSeed": true in package.json's prisma block.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { EXERCISES, GENERAL_ROUTINES, MACHINES } from "./seedData/catalog.js";
import { ACHIEVEMENT_CATALOG } from "../src/constants/achievementCatalog.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "sofibels+admin@gmail.com" },
    update: {},
    create: {
      email: "sofibels+admin@gmail.com",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      isActive: true,
      objectives: [], 
    },
  });

  const trainerUser = await prisma.user.upsert({
    where: { email: "sofibels+trainer@gmail.com" },
    update: {},
    create: {
      email: "sofibels+trainer@gmail.com",
      passwordHash,
      firstName: "John",
      lastName: "Trainer",
      role: "TRAINER",
      isActive: true,
      objectives: [], 
      trainerProfile: {
        create: { specialties: ["STRENGTH", "REHABILITATION"] },
      },
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: "sofibels+user@gmail.com" },
    update: {},
    create: {
      email: "sofibels+user@gmail.com",
      passwordHash,
      firstName: "Test",
      lastName: "User",
      role: "USER",
      isActive: true,
      objectives: ["IMPROVE_HEALTH", "INCREASE_ENDURANCE"],
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
  const achievementCatalog = ACHIEVEMENT_CATALOG;

  for (const def of achievementCatalog) {
    const existing = await prisma.achievement.findFirst({ where: { name: def.name } });
    if (!existing) {
      await prisma.achievement.create({ data: def });
    }
  }

  // Gym machines (the pattern-learning engine matches their names against
  // Exercise.machineKeywords, so they should exist before members train).
  for (const [name, zone, qrToken] of MACHINES) {
    await prisma.machine.upsert({
      where: { qrToken },
      update: { name, zone },
      create: { name, zone, qrToken, active: true },
    });
  }

  // Exercise catalog (built-in, visible to every member).
  const exerciseIdBySlug = {};
  for (const ex of EXERCISES) {
    const data = {
      name: ex.name,
      nameEn: ex.nameEn,
      description: ex.description,
      descriptionEn: ex.descriptionEn,
      muscles: ex.muscles,
      machineKeywords: ex.machineKeywords,
      level: ex.level,
      category: ex.category,
      defaultSets: ex.sets,
      defaultReps: ex.reps,
      isCustom: false,
      active: true,
    };
    const row = await prisma.exercise.upsert({
      where: { slug: ex.slug },
      update: data,
      create: { slug: ex.slug, ...data },
    });
    exerciseIdBySlug[ex.slug] = row.id;
  }

  // General routines ("rutinas generales"): items are rewritten on each run.
  for (const [position, [slug, title, titleEn, level, slugs]] of GENERAL_ROUTINES.entries()) {
    const routine = await prisma.generalRoutine.upsert({
      where: { slug },
      update: { title, titleEn, level, position, active: true },
      create: { slug, title, titleEn, level, position },
    });
    await prisma.generalRoutineExercise.deleteMany({ where: { routineId: routine.id } });
    await prisma.generalRoutineExercise.createMany({
      data: slugs.map((exSlug, index) => {
        const ex = EXERCISES.find((e) => e.slug === exSlug);
        return {
          routineId: routine.id,
          exerciseId: exerciseIdBySlug[exSlug],
          position: index,
          sets: ex.sets,
          reps: ex.reps,
        };
      }),
    });
  }

  console.log("Seed completed:", {
    admin: admin.email,
    trainer: trainerUser.email,
    user: normalUser.email,
    machine: machine.name,
    exercises: EXERCISES.length,
    generalRoutines: GENERAL_ROUTINES.length,
    machines: MACHINES.length,
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