import { z } from "zod";

// POST /social/:id/respond — Yes / No on the "¿Querés hacer un amigo?" pop-up.
export const respondSocialSchema = z.object({
  accept: z.boolean(),
});

// POST /social/:id/feedback — everything is optional ("Opcional" in the pop-up).
export const feedbackSocialSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  liked: z.boolean().optional(),
  report: z.boolean().optional(),
});
