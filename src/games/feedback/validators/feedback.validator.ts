import { z } from "zod";

// Mirrors the client-side check in
// kakan/src/components/feedback/PersonalDetailsStep.jsx.
const KENYAN_PHONE = /^(?:\+254|254|0)(7|1)\d{8}$/;

export const createFeedbackSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(KENYAN_PHONE, "Invalid phone number")),
  profession: z.string().trim().max(200).optional(),
  location: z.string().trim().min(1, "location is required").max(200),
  wantsBetterTuwan: z.boolean({ message: "wantsBetterTuwan is required" }),
  areasToImprove: z.array(z.string().trim().min(1)).default([]),
  additionalComment: z.string().trim().max(5000).optional(),
  consentToDataCollection: z.literal(true, {
    message: "consentToDataCollection must be accepted",
  }),
  consentToUpdates: z.boolean().default(false),
});

export const feedbackIdParamSchema = z.object({
  feedbackId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid feedback id"),
});

export const listFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
