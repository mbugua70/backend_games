import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as leaderboardConfigService from "../services/leaderboardConfig.service";
import {
  eventIdParamSchema,
  leaderboardConfigSchema,
} from "../validators/leaderboardConfig.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const createLeaderboardConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const input = leaderboardConfigSchema.parse(req.body);
    const config = await leaderboardConfigService.createLeaderboardConfig(
      adminOf(res).organizationId,
      eventId,
      input
    );
    sendSuccess(res, config, "Leaderboard config created", 201);
  }
);

export const getLeaderboardConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const config = await leaderboardConfigService.getLeaderboardConfigByEvent(
      adminOf(res).organizationId,
      eventId
    );
    sendSuccess(res, config);
  }
);

export const updateLeaderboardConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const input = leaderboardConfigSchema.parse(req.body);
    const config = await leaderboardConfigService.updateLeaderboardConfig(
      adminOf(res).organizationId,
      eventId,
      input
    );
    sendSuccess(res, config, "Leaderboard config updated");
  }
);
