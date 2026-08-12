import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as leaderboardService from "../services/leaderboard.service";
import { eventIdParamSchema, leaderboardQuerySchema } from "../validators/leaderboard.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const getLeaderboard = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const { limit } = leaderboardQuerySchema.parse(req.query);
    const leaderboard = await leaderboardService.getLeaderboardForAdmin(
      adminOf(res).organizationId,
      eventId,
      limit
    );
    sendSuccess(res, leaderboard);
  }
);
