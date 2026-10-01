import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as statsService from "../services/stats.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventIdParamSchema } from "../validators/common.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const stats = await statsService.getEventStats(orgId(res), eventId);
  sendSuccess(res, stats);
});
