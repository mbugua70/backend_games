import { z } from "zod";
import { MAX_OPTIONS, MIN_OPTIONS } from "../models/Question";
import { objectIdSchema } from "./common.validator";

const optionsSchema = z
  .array(z.string().trim().min(1, "Option text is required").max(300))
  .min(MIN_OPTIONS, `A question needs at least ${MIN_OPTIONS} options`)
  .max(MAX_OPTIONS, `A question can have at most ${MAX_OPTIONS} options`)
  .refine(
    (options) => new Set(options.map((o) => o.toLowerCase())).size === options.length,
    "Options within a question must be unique"
  );

// Admins author the correct answer as a position in `options` - simpler
// than making them echo back a generated option id. The service converts
// it to the stored correctOptionId.
export const createQuestionSchema = z
  .object({
    text: z.string().trim().min(1, "text is required").max(500),
    options: optionsSchema,
    correctOptionIndex: z.number().int().min(0),
    isActive: z.boolean().default(true),
  })
  .refine((q) => q.correctOptionIndex < q.options.length, {
    message: "correctOptionIndex must point at one of the options",
    path: ["correctOptionIndex"],
  });

// Replacing `options` requires restating which one is correct, since the
// old correct option no longer exists. correctOptionIndex alone re-points
// the answer within the existing options.
export const updateQuestionSchema = z
  .object({
    text: z.string().trim().min(1, "text is required").max(500).optional(),
    options: optionsSchema.optional(),
    correctOptionIndex: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((q) => q.options === undefined || q.correctOptionIndex !== undefined, {
    message: "correctOptionIndex is required when replacing options",
    path: ["correctOptionIndex"],
  })
  .refine(
    (q) =>
      q.options === undefined ||
      q.correctOptionIndex === undefined ||
      q.correctOptionIndex < q.options.length,
    { message: "correctOptionIndex must point at one of the options", path: ["correctOptionIndex"] }
  );

export const bulkCreateQuestionsSchema = z.object({
  questions: z.array(createQuestionSchema).min(1).max(500),
});

export const listQuestionsQuerySchema = z.object({
  isActive: z.enum(["true", "false"]).optional(),
});

export const questionIdParamSchema = z.object({
  questionId: objectIdSchema("question id"),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
