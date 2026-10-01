import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as adminWinService from "../services/adminWin.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventAndWinIdParamSchema, eventIdParamSchema } from "../validators/common.validator";
import { adminListWinsQuerySchema } from "../validators/win.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;
const adminId = (res: Response): string => (res.locals.admin as AdminTokenPayload).adminId;

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const query = adminListWinsQuerySchema.parse(req.query);
  const result = await adminWinService.listWins(orgId(res), eventId, query);
  sendSuccess(res, result);
});

export const claim = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, winId } = eventAndWinIdParamSchema.parse(req.params);
  const result = await adminWinService.markWinClaimed(orgId(res), eventId, winId, adminId(res));
  sendSuccess(res, result, "Win marked as claimed");
});
