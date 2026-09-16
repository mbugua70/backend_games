import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as sessionService from "../services/session.service";
import { sessionIdParamSchema, startSessionSchema } from "../validators/session.validator";

const getIdempotencyKey = (req: Request): string | null => {
  const header = req.headers["idempotency-key"];
  return typeof header === "string" && header.trim().length > 0 ? header.trim() : null;
};

export const start = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = startSessionSchema.parse(req.body);
  const { session, wasCreated } = await sessionService.startSession(
    input.participantId,
    getIdempotencyKey(req)
  );
  sendSuccess(
    res,
    session,
    wasCreated ? "Session started" : "Session already started",
    wasCreated ? 201 : 200
  );
});

export const getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = sessionIdParamSchema.parse(req.params);
  const session = await sessionService.getSessionForResume(sessionId);
  sendSuccess(res, session);
});

export const complete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = sessionIdParamSchema.parse(req.params);
  const result = await sessionService.completeSession(sessionId);
  sendSuccess(res, result, "Session completed");
});

export const getResult = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = sessionIdParamSchema.parse(req.params);
  const result = await sessionService.getResult(sessionId);
  sendSuccess(res, result);
});
