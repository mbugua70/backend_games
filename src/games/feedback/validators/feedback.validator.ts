import { z } from "zod";

export const createFeedbackSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  email: z.string().trim().email("Invalid email").max(320),
  message: z.string().trim().min(1, "message is required").max(5000),
});

export const feedbackIdParamSchema = z.object({
  feedbackId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid feedback id"),
});

export const listFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
