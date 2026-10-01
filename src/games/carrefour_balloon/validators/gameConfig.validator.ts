import { z } from "zod";

export const gameConfigQuerySchema = z.object({
  brandId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid brand id")
    .optional(),
});
