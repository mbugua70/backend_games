import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as authService from "../services/auth.service";
import { loginSchema } from "../validators/auth.validator";

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    sendSuccess(res, result, "Logged in");
  }
);
