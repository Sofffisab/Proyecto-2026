import prisma from "../config/prisma.js";

/**
 * Procesa denuncias pendientes automáticamente (reglas futuras)
 */
export async function processComplaints() {
  const complaints = await prisma.complaint.findMany({
    where: { status: "PENDING" },
  });

  for (const c of complaints) {
    console.log("Pending complaint:", c.id);

    // futuro: scoring automático / IA / reglas
  }
}