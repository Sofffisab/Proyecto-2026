import { z } from "zod";
import { DENUNCIA_TYPES } from "../services/denuncia.service.js";

const denunciaItem = z
  .object({
    type: z.enum(DENUNCIA_TYPES),
    // Trainer / member being reported (TRAINER_*, MEMBER_MISCONDUCT).
    reportedUserId: z.string().uuid().optional(),
    // Broken machine (MACHINE_BROKEN).
    machineId: z.string().uuid().optional(),
    comment: z.string().trim().max(500).optional(),
  })
  .refine((d) => (d.type === "MACHINE_BROKEN" ? Boolean(d.machineId) : Boolean(d.reportedUserId)), {
    message: "Missing the person or machine being reported",
  });

// POST /gym/sessions/:id/checkout-feedback — everything in the exit pop-up, all optional.
export const checkoutFeedbackSchema = z.object({
  dayRating: z.number().int().min(1).max(5).optional(),
  trainerRatings: z
    .array(z.object({ trainerId: z.string().uuid(), rating: z.number().int().min(1).max(5) }))
    .max(20)
    .optional(),
  denuncias: z.array(denunciaItem).max(30).optional(),
});

export const updateDenunciaStatusSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "DISMISSED"]),
});
