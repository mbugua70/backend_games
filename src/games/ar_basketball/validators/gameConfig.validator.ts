import { z } from "zod";

export const gameConfigSchema = z.object({
  durationSeconds: z.number().int().positive(),
  normalBasketPoints: z.number().min(0),
  swishEnabled: z.boolean().default(true),
  swishPoints: z.number().min(0),
  longRangeEnabled: z.boolean().default(true),
  longRangeDistanceMeters: z.number().min(0),
  longRangePoints: z.number().min(0),
  streakEnabled: z.boolean().default(true),
  streakRequired: z.number().int().min(2),
  streakBonusPoints: z.number().min(0),
  leaderboardEnabled: z.boolean().default(true),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});
