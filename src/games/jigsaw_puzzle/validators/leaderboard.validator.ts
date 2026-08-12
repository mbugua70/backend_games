import { z } from "zod";

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});
