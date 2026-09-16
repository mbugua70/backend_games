import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as sessionService from "../services/session.service";
import { listSessionsQuerySchema } from "../validators/adminSession.validator";
import { sessionIdParamSchema } from "../validators/session.validator";

const orgOf = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = listSessionsQuerySchema.parse(req.query);
  const result = await sessionService.listAdminSessions(orgOf(res), query);
  sendSuccess(res, result);
});

export const getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = sessionIdParamSchema.parse(req.params);
  const session = await sessionService.getAdminSessionById(orgOf(res), sessionId);
  sendSuccess(res, session);
});
