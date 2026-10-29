import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const [email, password, firstName = "Test", lastName = "User", roleArg = "USER"] = process.argv.slice(2);
const role = roleArg.toUpperCase();

if (!email || !password || !["USER", "TRAINER", "ADMIN"].includes(role)) {
  console.error("Uso: node prisma/createUser.js <email> <password> [firstName] [lastName] [USER|TRAINER|ADMIN]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const memberProfile =
    role === "USER"
      ? {
          birthday: new Date("1995-05-05"),
          medicalConditions: [],
          deliveryAddress: "Calle 123",
          trainingLevel: "BEGINNER",
          objectives: ["IMPROVE_HEALTH"],
          weeklyTrainingDays: "THREE",
          trainingType: "MIXED",
          isProfileComplete: true,
        }
      : { objectives: [] };

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, firstName, lastName, role, isActive: true, ...memberProfile },
  });
  console.log(`OK: ${user.role} ${user.email} (id ${user.id})`);
} finally {
  await prisma.$disconnect();
}
