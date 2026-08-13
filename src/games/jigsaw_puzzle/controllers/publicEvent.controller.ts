import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as eventService from "../services/event.service";
import * as gameConfigService from "../services/gameConfig.service";
import { eventCodeParamSchema } from "../validators/publicGameParams.validator";

// Everything the game client needs to render registration/config screens for
// an event, in one call - event details plus its GameConfig.
export const getEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { code } = eventCodeParamSchema.parse(req.params);
    const event = await eventService.getEventByCode(code);
    const gameConfig = await gameConfigService.getGameConfigByEventId(event.id);
    sendSuccess(res, { event, gameConfig });
  }
);
