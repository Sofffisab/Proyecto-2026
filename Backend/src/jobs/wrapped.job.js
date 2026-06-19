import prisma from "../config/prisma.js";
import { generateWrapped } from "../services/wrapped.service.js";

export async function generateAnnualWrapped(year) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    await generateWrapped(user.id, year);
  }
}