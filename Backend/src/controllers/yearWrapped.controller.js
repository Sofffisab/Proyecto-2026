// YearWrapped/backend/yearWrapped.controller.js
// GET /analytics/year-wrapped — ver Backend/src/routes/index.js
import { prisma } from "../config/index.js";
import { generateYearWrapped } from "./yearWrapped.service.js";

// GET /analytics/year-wrapped?year=2026
export async function getYearWrapped(req, res, next) {
  try {
    const year = parseInt(req.query.year ?? new Date().getFullYear(), 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ success: false, message: "Año inválido" });
    }
    const data = await generateYearWrapped(prisma, req.user.id, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
