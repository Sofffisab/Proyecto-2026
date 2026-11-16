import "dotenv/config";
import { prisma } from "./src/config/index.js";

const r = await prisma.assistance.updateMany({
  where: { status: "PENDING" },
  data: { status: "EXPIRED" },
});
console.log("✅ Pedidos de ayuda viejos cerrados:", r.count);

const d = await prisma.denuncia.findMany({
  orderBy: { createdAt: "desc" }, take: 10,
  select: { id: true, type: true, status: true, createdAt: true },
});
console.log("Denuncias:", d);

const c = await prisma.complaint.findMany({
  orderBy: { createdAt: "desc" }, take: 10,
  select: { id: true, status: true, source: true, createdAt: true },
});
console.log("Complaints:", c);
process.exit(0);
