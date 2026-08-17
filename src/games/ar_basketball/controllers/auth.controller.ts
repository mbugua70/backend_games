import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as authService from "../services/auth.service";
import { loginSchema, refreshSchema } from "../validators/auth.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);
  sendSuccess(res, result, "Logged in");
});

export const refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refresh(refreshToken);
  sendSuccess(res, result, "Token refreshed");
});

export const me = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const admin = await authService.getMe(adminOf(res).adminId);
  sendSuccess(res, admin);
});
