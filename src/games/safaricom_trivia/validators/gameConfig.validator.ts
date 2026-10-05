import { z } from "zod";

// Hex (#rgb/#rrggbb) or a CSS colour keyword - whatever the frontend can
// drop straight into a style backgroundColor.
const colorSchema = z
  .string()
  .trim()
  .regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|[a-zA-Z]{3,30})$/, "Invalid colour");

export const updateGameConfigSchema = z
  .object({
    questionsPerGame: z.number().int().min(1).max(50).optional(),
    questionTimeLimitMs: z.number().int().min(1000).max(120_000).optional(),
    totalTimeLimitMs: z.number().int().min(1000).max(3_600_000).optional(),
    answerColors: z.array(colorSchema).min(1).max(6).optional(),
  })
  .refine((input) => Object.values(input).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

export type UpdateGameConfigInput = z.infer<typeof updateGameConfigSchema>;
