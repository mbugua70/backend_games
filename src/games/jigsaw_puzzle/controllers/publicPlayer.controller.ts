import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as playerService from "../services/player.service";
import { eventCodeParamSchema } from "../validators/publicGameParams.validator";
import { registerPlayerSchema } from "../validators/publicPlayer.validator";

export const registerPlayer = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { code } = eventCodeParamSchema.parse(req.params);
    const { registrationData } = registerPlayerSchema.parse(req.body);
    const player = await playerService.registerPlayer(code, registrationData);
    sendSuccess(res, player, "Player registered", 201);
  }
);
