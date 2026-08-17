import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as eventService from "../services/event.service";
import * as leaderboardService from "../services/leaderboard.service";
import { leaderboardQuerySchema } from "../validators/leaderboard.validator";
import { eventCodeParamSchema } from "../validators/publicGameParams.validator";

export const getLeaderboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code } = eventCodeParamSchema.parse(req.params);
  const { limit } = leaderboardQuerySchema.parse(req.query);
  const event = await eventService.getEventByCode(code);
  const leaderboard = await leaderboardService.getLeaderboard(event.id, limit);
  sendSuccess(res, leaderboard);
});
