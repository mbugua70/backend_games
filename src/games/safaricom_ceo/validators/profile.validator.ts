import { z } from "zod";
import { DIMENSIONS } from "../models/Question";
import { objectIdSchema } from "./common.validator";

const nextFrontierEntrySchema = z.object({
  dimension: z.enum(DIMENSIONS),
  explanation: z.string().trim().min(1, "explanation is required").max(1000),
});

export const createProfileSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, "code is required").max(50),
  name: z.string().trim().min(1, "name is required").max(200),
  tagline: z.string().trim().min(1, "tagline is required").max(200),
  description: z.string().trim().min(1, "description is required").max(2000),
  strengths: z.array(z.enum(DIMENSIONS)).min(1, "strengths is required"),
  nextFrontier: z.array(nextFrontierEntrySchema).min(1, "nextFrontier is required"),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

// code is intentionally not editable - see services/profile.service.ts's
// updateProfile doc comment.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200).optional(),
  tagline: z.string().trim().min(1, "tagline is required").max(200).optional(),
  description: z.string().trim().min(1, "description is required").max(2000).optional(),
  strengths: z.array(z.enum(DIMENSIONS)).min(1, "strengths is required").optional(),
  nextFrontier: z.array(nextFrontierEntrySchema).min(1, "nextFrontier is required").optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const profileIdParamSchema = z.object({
  profileId: objectIdSchema("profile id"),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
