import { z } from "zod";

export const createEventSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1).toLowerCase(),
  registrationEnabled: z.boolean().optional(),
});

export const updateEventSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["draft", "live", "paused", "ended"]).optional(),
  registrationEnabled: z.boolean().optional(),
});

export const switchGiftPoolModeSchema = z.object({
  giftPoolMode: z.enum(["shared", "perBrand"]),
});
