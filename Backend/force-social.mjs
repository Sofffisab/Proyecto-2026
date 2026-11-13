import "dotenv/config";
import { prisma, redis } from "./src/config/index.js";
import { runMatchingRound, getSocialConfig } from "./src/services/social.service.js";

const s = await prisma.gymSession.findFirst({ 
  where: { checkOutAt: null }, 
  select: { userId: true } 
});

if (!s) { 
  console.log("❌ Nadie tiene check-in abierto en la BD."); 
  process.exit(0); 
}

const slot = Math.floor(Date.now() / getSocialConfig().roundIntervalMs);
await redis?.del(`social:round:${slot}`);

console.log("🚀 Resultado:", await runMatchingRound(s.userId));
process.exit(0);
