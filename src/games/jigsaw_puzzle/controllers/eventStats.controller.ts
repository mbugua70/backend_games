import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as eventStatsService from "../services/eventStats.service";
import { eventIdParamSchema } from "../validators/eventStats.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const getStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const stats = await eventStatsService.getEventStats(adminOf(res).organizationId, eventId);
    sendSuccess(res, stats);
  }
);
