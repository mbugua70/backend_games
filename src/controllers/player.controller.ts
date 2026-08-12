import { Request, Response } from "express";
import * as playerService from "../services/player.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/response";
import { loginSchema } from "../validators/player.validator";

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { staffId, name } = loginSchema.parse(req.body);
    const result = await playerService.loginPlayer(staffId, name);
    sendSuccess(res, result, "Logged in");
  }
);
