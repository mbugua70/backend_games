import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as analyticsService from "../services/analytics.service";
import { analyticsSummaryQuerySchema } from "../validators/analytics.validator";

const orgOf = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const summary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = analyticsSummaryQuerySchema.parse(req.query);
  const result = await analyticsService.getAnalyticsSummary(orgOf(res), query);
  sendSuccess(res, result);
});
