import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyAdminToken } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: { id: string };
    }
  }
}

const BEARER_PREFIX = "Bearer ";

/**
 * Gate for every /api/admin/reports route (and GET /api/admin/auth/me).
 * Bearer-token only, verified against JWT_SECRET - doesn't hit the DB on
 * every request, the token's signature/expiry is the auth boundary. If an
 * admin account is later removed, its already-issued tokens keep working
 * until they expire (JWT_EXPIRES_IN), which is an acceptable trade for a
 * short-lived event dashboard with no revocation list.
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.header("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(new AppError("Missing or malformed Authorization header", 401));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();

  try {
    const { adminId } = verifyAdminToken(token);
    req.admin = { id: adminId };
    next();
  } catch {
    next(new AppError("Invalid or expired admin session", 401));
  }
};
