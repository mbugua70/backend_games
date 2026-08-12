import { Request, Response } from "express";
import * as adminService from "../services/admin.service";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/response";
import { adminLoginSchema } from "../validators/admin.validator";

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = adminLoginSchema.parse(req.body);
    const result = await adminService.loginAdmin(email, password);
    sendSuccess(res, result, "Logged in");
  }
);

export const me = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.admin) {
      throw new AppError("Not authenticated", 401);
    }
    const email = await adminService.getAdminEmailById(req.admin.id);
    sendSuccess(res, { email });
  }
);
