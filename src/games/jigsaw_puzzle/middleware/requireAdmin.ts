import { NextFunction, Request, Response } from "express";
import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";
import { verifyToken } from "../../../core/utils/authToken";

export interface AdminTokenPayload {
  adminId: string;
  organizationId: string;
  username: string;
}

// Attached to res.locals rather than req (and typed via this return, not a
// global Express.Request augmentation) so a second game's admin middleware
// can never collide with this one's shape.
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    next(new AppError("Missing bearer token", 401));
    return;
  }

  try {
    res.locals.admin = verifyToken<AdminTokenPayload>(token, env.JWT_SECRET);
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
};
