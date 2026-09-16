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

// Stateless JWT auth (see auth.service.ts) means there is no server-side
// session to invalidate here - the client is expected to discard both
// tokens on logout, same as any other stateless-JWT API. This endpoint
// still exists (protected, so a bad/expired token 401s the same as any
// other admin route) so the frontend has one call to make, and so a future
// move to server-side revocation only means implementing this handler's
// body, not adding a new route/contract.
export const logout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, null, "Logged out");
});
