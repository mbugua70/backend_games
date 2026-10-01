import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const recordWinSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  brandId: objectId,
  giftPoolId: objectId,
  giftId: objectId,
  roundId: z.string().trim().min(1).max(200),
  balloonId: z.string().trim().min(1).max(200),
  configVersion: z.number().int().nonnegative(),
  // Required only when the event has registration disabled - enforced in
  // win.service.ts against the live Event.registrationEnabled value, not
  // here, since this schema has no access to that.
  anonymousIdentity: z.string().trim().min(1).max(200).optional(),
});

export const adminListWinsQuerySchema = z.object({
  brandId: objectId.optional(),
  claimStatus: z.enum(["pending", "claimed"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
