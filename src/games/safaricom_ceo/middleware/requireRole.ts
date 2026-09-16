import { NextFunction, Request, Response } from "express";
import { AppError } from "../../../core/utils/AppError";
import { AdminRole } from "../models/Admin";
import { AdminTokenPayload } from "./requireAdmin";

// Must run after requireAdmin, which populates res.locals.admin.
export const requireRole = (...allowedRoles: AdminRole[]) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const admin = res.locals.admin as AdminTokenPayload | undefined;
    if (!admin || !allowedRoles.includes(admin.role)) {
      next(new AppError("Insufficient permissions for this action", 403));
      return;
    }
    next();
  };
};
