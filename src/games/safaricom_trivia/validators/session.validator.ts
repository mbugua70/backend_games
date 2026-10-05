import { z } from "zod";
import { objectIdSchema } from "./common.validator";

export const sessionIdParamSchema = z.object({
  sessionId: objectIdSchema("session id"),
});

// No score field on purpose - the server computes it (see
// services/scoring.service.ts). selectedOptionId null = skipped.
export const submitSessionSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectIdSchema("question id"),
        selectedOptionId: objectIdSchema("option id").nullable(),
      })
    )
    .max(50, "Too many answers"),
});

export type SubmitSessionInput = z.infer<typeof submitSessionSchema>;
