import { z } from "zod";

export const leaderboardConfigSchema = z.object({
  rankingStrategy: z
    .enum(["highest_score", "highest_score_then_fastest", "highest_score_then_best_accuracy"])
    .default("highest_score"),
  displayLimit: z.number().int().min(1).max(100).default(10),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});
