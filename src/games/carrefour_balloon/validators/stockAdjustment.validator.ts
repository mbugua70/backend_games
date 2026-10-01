import { z } from "zod";

export const listStockAdjustmentsQuerySchema = z.object({
  giftPoolEntryId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid gift pool entry id")
    .optional(),
});
