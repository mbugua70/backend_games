import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as entryService from "../services/giftPoolEntry.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventIdParamSchema } from "../validators/common.validator";
import { listStockAdjustmentsQuerySchema } from "../validators/stockAdjustment.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const { giftPoolEntryId } = listStockAdjustmentsQuerySchema.parse(req.query);
  const logs = await entryService.listStockAdjustments(orgId(res), eventId, giftPoolEntryId);
  sendSuccess(res, logs);
});
