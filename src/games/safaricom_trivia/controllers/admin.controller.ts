import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as gameConfigService from "../services/gameConfig.service";
import * as resultsService from "../services/results.service";
import { updateGameConfigSchema } from "../validators/gameConfig.validator";
import { leaderboardQuerySchema, listPlayersQuerySchema } from "../validators/results.validator";

const orgOf = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const getConfig = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const config = await gameConfigService.getAdminGameConfig(orgOf(res));
  sendSuccess(res, config);
});

export const updateConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = updateGameConfigSchema.parse(req.body);
  const config = await gameConfigService.updateGameConfig(orgOf(res), input);
  sendSuccess(res, config, "Game config updated");
});

export const listPlayers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = listPlayersQuerySchema.parse(req.query);
  const result = await resultsService.listPlayers(orgOf(res), query);
  sendSuccess(res, result);
});

export const leaderboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = leaderboardQuerySchema.parse(req.query);
  const result = await resultsService.getLeaderboard(orgOf(res), query);
  sendSuccess(res, result);
});
