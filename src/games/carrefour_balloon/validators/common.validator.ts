import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const eventIdParamSchema = z.object({ eventId: objectIdSchema });
export const eventAndBrandIdParamSchema = z.object({ eventId: objectIdSchema, brandId: objectIdSchema });
export const eventAndPoolIdParamSchema = z.object({ eventId: objectIdSchema, poolId: objectIdSchema });
export const eventAndGiftIdParamSchema = z.object({ eventId: objectIdSchema, giftId: objectIdSchema });
export const eventAndWinIdParamSchema = z.object({ eventId: objectIdSchema, winId: objectIdSchema });
export const poolAndEntryIdParamSchema = z.object({
  eventId: objectIdSchema,
  poolId: objectIdSchema,
  entryId: objectIdSchema,
});
export const eventAndEntryIdParamSchema = z.object({
  eventId: objectIdSchema,
  entryId: objectIdSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
