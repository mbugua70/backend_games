import { z } from "zod";

const scoreAnswerSchema = z.object({
  puzzleId: z.string().trim().min(1),
  selected: z.string().trim().min(1).nullable(),
  correct: z.boolean(),
  timedOut: z.boolean(),
});

// REST: POST /api/scores/submit
export const submitScoreSchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required"),
  playerId: z.string().trim().min(1, "playerId is required"),
  staffId: z.string().trim().min(1, "staffId is required"),
  name: z.string().trim().min(1, "name is required"),
  score: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  totalPuzzles: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  answers: z.array(scoreAnswerSchema).default([]),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
