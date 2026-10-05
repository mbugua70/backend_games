import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { PlayerTokenPayload } from "../middleware/requirePlayer";
import * as gameConfigService from "../services/gameConfig.service";
import * as playerService from "../services/player.service";
import * as sessionService from "../services/session.service";
import { registerPlayerSchema } from "../validators/player.validator";
import { sessionIdParamSchema, submitSessionSchema } from "../validators/session.validator";

const playerOf = (res: Response): PlayerTokenPayload => res.locals.player as PlayerTokenPayload;

export const getConfig = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const config = await gameConfigService.getPublicGameConfig();
  sendSuccess(res, config);
});

export const registerPlayer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = registerPlayerSchema.parse(req.body);
  const { wasCreated, ...result } = await playerService.registerPlayer(input);
  sendSuccess(
    res,
    result,
    wasCreated ? "Player registered" : "Welcome back - continue your game",
    wasCreated ? 201 : 200
  );
});

export const startSession = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const payload = await sessionService.startOrResumeSession(playerOf(res).playerId);
  sendSuccess(res, payload);
});

export const submitSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = sessionIdParamSchema.parse(req.params);
  const input = submitSessionSchema.parse(req.body);
  const result = await sessionService.submitSession(playerOf(res).playerId, sessionId, input);
  sendSuccess(res, result, "Game completed");
});
