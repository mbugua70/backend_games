import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as gameConfigService from "../services/gameConfig.service";
import { eventIdParamSchema, gameConfigSchema } from "../validators/gameConfig.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const createGameConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const input = gameConfigSchema.parse(req.body);
    const config = await gameConfigService.createGameConfig(
      adminOf(res).organizationId,
      eventId,
      input
    );
    sendSuccess(res, config, "Game config created", 201);
  }
);

export const getGameConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const config = await gameConfigService.getGameConfigByEvent(
      adminOf(res).organizationId,
      eventId
    );
    sendSuccess(res, config);
  }
);

export const updateGameConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const input = gameConfigSchema.parse(req.body);
    const config = await gameConfigService.updateGameConfig(
      adminOf(res).organizationId,
      eventId,
      input
    );
    sendSuccess(res, config, "Game config updated");
  }
);
