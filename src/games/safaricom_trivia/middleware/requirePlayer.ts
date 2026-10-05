import { NextFunction, Request, Response } from "express";
import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";
import { verifyToken } from "../../../core/utils/authToken";

export const PLAYER_TOKEN_TYPE = "safaricom_trivia_player";

export interface PlayerTokenPayload {
  playerId: string;
  organizationId: string;
  type: typeof PLAYER_TOKEN_TYPE;
}

// Signed with the same JWT_SECRET as admin tokens, so the `type` check is
// what keeps the two apart: requireAdmin rejects anything not typed
// "access", and this rejects anything not typed as a player token.
export const requirePlayer = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    next(new AppError("Missing bearer token", 401));
    return;
  }

  try {
    const payload = verifyToken<PlayerTokenPayload>(token, env.JWT_SECRET);
    if (payload.type !== PLAYER_TOKEN_TYPE) {
      next(new AppError("Invalid or expired token", 401));
      return;
    }
    res.locals.player = payload;
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
};
