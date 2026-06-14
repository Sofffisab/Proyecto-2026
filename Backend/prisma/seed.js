import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

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
        create: {
          specialties: ["STRENGTH", "REHABILITATION"],
        },
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

  const machine = await prisma.machine.create({
    data: {
      name: "Bench Press",
      qrToken: "bench-press-qr-001",
      active: true,
    },
  });

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