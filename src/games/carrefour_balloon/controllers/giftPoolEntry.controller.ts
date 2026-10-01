import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as entryService from "../services/giftPoolEntry.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import {
  eventAndEntryIdParamSchema,
  eventAndPoolIdParamSchema,
  poolAndEntryIdParamSchema,
} from "../validators/common.validator";
import {
  adjustStockSchema,
  createGiftPoolEntrySchema,
  updateGiftPoolEntrySchema,
} from "../validators/giftPoolEntry.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;
const adminId = (res: Response): string => (res.locals.admin as AdminTokenPayload).adminId;

// Admin API speaks whole percent ("5" = 5%); the model/service layer
// stores integer basis points out of 10000 (see validators/
// giftPoolEntry.validator.ts's comment on probabilityPercentSchema).
const toBasisPoints = (percent: number): number => Math.round(percent * 100);
const toPercent = (basisPoints: number): number => basisPoints / 100;

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, poolId } = eventAndPoolIdParamSchema.parse(req.params);
  const entries = await entryService.listEntries(orgId(res), eventId, poolId);
  sendSuccess(res, entries.map((e) => ({ ...e, probabilityPercent: toPercent(e.probabilityPercent) })));
});

export const create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, poolId } = eventAndPoolIdParamSchema.parse(req.params);
  const input = createGiftPoolEntrySchema.parse(req.body);
  const entry = await entryService.createEntry(orgId(res), eventId, poolId, {
    ...input,
    probabilityPercent: toBasisPoints(input.probabilityPercent),
  });
  sendSuccess(
    res,
    { ...entry, probabilityPercent: toPercent(entry.probabilityPercent) },
    "Gift pool entry created",
    201
  );
});

export const update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, poolId, entryId } = poolAndEntryIdParamSchema.parse(req.params);
  const input = updateGiftPoolEntrySchema.parse(req.body);
  const entry = await entryService.updateEntry(orgId(res), eventId, poolId, entryId, {
    ...input,
    probabilityPercent:
      input.probabilityPercent !== undefined ? toBasisPoints(input.probabilityPercent) : undefined,
  });
  sendSuccess(res, { ...entry, probabilityPercent: toPercent(entry.probabilityPercent) }, "Gift pool entry updated");
});

export const adjustStock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, entryId } = eventAndEntryIdParamSchema.parse(req.params);
  const { amount, reason } = adjustStockSchema.parse(req.body);
  const result = await entryService.adjustStock(orgId(res), eventId, entryId, adminId(res), amount, reason);
  sendSuccess(res, result, "Stock adjusted");
});
