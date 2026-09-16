import { z } from "zod";
import { DIMENSIONS } from "../models/Question";
import { objectIdSchema } from "./common.validator";

const answerOptionInputSchema = z.object({
  text: z.string().trim().min(1, "text is required").max(300),
  level: z.number().int().min(1).max(5),
  order: z.number().int().min(1),
  isActive: z.boolean().default(true),
});

// A question is always authored with its 5 options - see
// services/question.service.ts's assertUniqueOptionOrders/assertActivatable
// for what "valid" additionally requires before isActive can be true.
const optionsSchema = z
  .array(answerOptionInputSchema)
  .length(5, "A question must have exactly 5 options");

export const createQuestionSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  text: z.string().trim().min(1, "text is required").max(500),
  order: z.number().int().min(1),
  isActive: z.boolean().default(false),
  options: optionsSchema,
});

export const updateQuestionSchema = z.object({
  dimension: z.enum(DIMENSIONS).optional(),
  text: z.string().trim().min(1, "text is required").max(500).optional(),
  order: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  options: optionsSchema.optional(),
});

export const questionIdParamSchema = z.object({
  questionId: objectIdSchema("question id"),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
