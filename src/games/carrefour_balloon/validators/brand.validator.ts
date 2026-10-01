import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().trim().min(1),
  logoUrl: z.string().trim().min(1),
  displayOrder: z.number().int().positive(),
  enabled: z.boolean().optional(),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1).optional(),
  logoUrl: z.string().trim().min(1).optional(),
  displayOrder: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});
