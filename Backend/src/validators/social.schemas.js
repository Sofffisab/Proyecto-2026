import { z } from "zod";

// POST /social/:id/respond — Yes / No on the "¿Querés hacer un amigo?" pop-up.
export const respondSocialSchema = z.object({
  accept: z.boolean(),
});
