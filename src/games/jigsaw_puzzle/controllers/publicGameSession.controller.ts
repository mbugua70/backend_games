import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as gameSessionService from "../services/gameSession.service";
import { eventCodeParamSchema, sessionUuidParamSchema } from "../validators/publicGameParams.validator";
import { completeSessionSchema, startSessionSchema } from "../validators/publicGameSession.validator";

export const startSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { code } = eventCodeParamSchema.parse(req.params);
    const { playerId, difficultyKey } = startSessionSchema.parse(req.body);
    const session = await gameSessionService.startSession(code, playerId, difficultyKey);
    sendSuccess(res, session, "Session started", 201);
  }
);

export const completeSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { sessionUuid } = sessionUuidParamSchema.parse(req.params);
    const { moves, hintsUsed } = completeSessionSchema.parse(req.body);
    const session = await gameSessionService.completeSession(sessionUuid, moves, hintsUsed);
    sendSuccess(res, session, "Session completed");
  }
);
