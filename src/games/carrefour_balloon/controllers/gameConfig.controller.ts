import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as gameConfigService from "../services/gameConfig.service";
import { eventIdParamSchema } from "../validators/common.validator";
import { gameConfigQuerySchema } from "../validators/gameConfig.validator";

export const getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const { brandId } = gameConfigQuerySchema.parse(req.query);
  const config = await gameConfigService.getGameConfig(eventId, brandId ?? null);
  sendSuccess(res, config);
});
