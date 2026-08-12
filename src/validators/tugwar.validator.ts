import { z } from "zod";
import { TUGWAR_PILLARS, TUGWAR_WINNERS } from "../types/tugwar.types";

const tugWarPlayerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  pillar: z.enum(TUGWAR_PILLARS),
});

// REST: POST /api/tugwar/matches/start
export const startMatchSchema = z
  .object({
    left: tugWarPlayerSchema,
    right: tugWarPlayerSchema,
  })
  .refine((data) => data.left.pillar !== data.right.pillar, {
    message: "Both players picked the same pillar - pillars must be unique per match",
    path: ["right", "pillar"],
  });

export type StartMatchInput = z.infer<typeof startMatchSchema>;

// REST: POST /api/tugwar/matches/:sessionId/finish
export const finishMatchSchema = z.object({
  leftScore: z.number().int().min(0),
  rightScore: z.number().int().min(0),
  winnerSide: z.enum(TUGWAR_WINNERS),
  durationMs: z.number().int().min(0),
});

export type FinishMatchInput = z.infer<typeof finishMatchSchema>;

// REST: POST /api/tugwar/matches/:sessionId/finish (route param)
export const sessionIdParamSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required"),
});
