import { z } from "zod";

// Admins think in whole/fractional percent (e.g. "5%", "15.5%"); the
// backend stores integer basis points out of 10000 (see
// models/GiftPoolEntry.ts's PROBABILITY_UNITS_TOTAL). The controller
// converts percent -> basis points before calling the service, so this
// validator is the only place "100" means "100%" rather than "100 basis
// points".
const probabilityPercentSchema = z.number().min(0).max(100);

export const createGiftPoolEntrySchema = z.object({
  giftId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid gift id"),
  visible: z.boolean().optional(),
  awardEnabled: z.boolean().optional(),
  availableQuantity: z.number().int().min(0).optional(),
  probabilityPercent: probabilityPercentSchema,
  displayOrder: z.number().int().positive(),
});

export const updateGiftPoolEntrySchema = z.object({
  visible: z.boolean().optional(),
  awardEnabled: z.boolean().optional(),
  probabilityPercent: probabilityPercentSchema.optional(),
  displayOrder: z.number().int().positive().optional(),
});

export const adjustStockSchema = z.object({
  amount: z.number().int().refine((v) => v !== 0, "amount must not be zero"),
  reason: z.string().trim().min(1),
});
