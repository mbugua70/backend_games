import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as gameSessionService from "../services/gameSession.service";
import {
  eventCodeParamSchema,
  sessionUuidParamSchema,
} from "../validators/publicGameParams.validator";
import {
  completeSessionSchema,
  startSessionSchema,
} from "../validators/publicGameSession.validator";

export const startSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code } = eventCodeParamSchema.parse(req.params);
  const { sessionUuid, playerId } = startSessionSchema.parse(req.body);
  const { session, wasCreated } = await gameSessionService.startSession(
    code,
    sessionUuid,
    playerId
  );
  // 201 only for the genuine first creation - a retried "start" call with
  // the same sessionUuid returns 200 with the existing session, per the
  // offline-safe/idempotent design requirement.
  sendSuccess(
    res,
    session,
    wasCreated ? "Session started" : "Session already started",
    wasCreated ? 201 : 200
  );
});

export const completeSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionUuid } = sessionUuidParamSchema.parse(req.params);
  const { shots, submittedScore } = completeSessionSchema.parse(req.body);
  const session = await gameSessionService.completeSession(sessionUuid, shots, submittedScore);
  sendSuccess(res, session, "Session completed");
});
