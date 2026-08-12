import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as gameSessionService from "../services/gameSession.service";
import { eventIdParamSchema, sessionIdParamSchema } from "../validators/gameSession.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const listSessions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const sessions = await gameSessionService.listSessionsByEvent(
      adminOf(res).organizationId,
      eventId
    );
    sendSuccess(res, sessions);
  }
);

export const getSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId, sessionId } = sessionIdParamSchema.parse(req.params);
    const session = await gameSessionService.getSessionById(
      adminOf(res).organizationId,
      eventId,
      sessionId
    );
    sendSuccess(res, session);
  }
);
