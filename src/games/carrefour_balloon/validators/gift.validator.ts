import { z } from "zod";

export const createGiftSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  imageUrl: z.string().trim().nullable().optional(),
});

export const updateGiftSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  imageUrl: z.string().trim().nullable().optional(),
});

export const listGiftsQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional().default(false),
});
