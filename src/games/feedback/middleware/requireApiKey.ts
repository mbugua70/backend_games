import { timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";

const API_KEY_HEADER = "x-api-key";

// This module has no JWT/admin login of its own (see CLAUDE.md) - a single
// shared secret in the x-api-key header is its only gate, for every route
// including submission.
export const requireApiKey = (req: Request, _res: Response, next: NextFunction): void => {
  const provided = req.headers[API_KEY_HEADER];

  if (typeof provided !== "string" || provided.length === 0) {
    next(new AppError("Missing API key", 401));
    return;
  }

  const expected = Buffer.from(env.FEEDBACK_API_KEY);
  const actual = Buffer.from(provided);

  // timingSafeEqual throws on length mismatch rather than returning false,
  // and a length difference is itself safe to leak (only the byte contents
  // need constant-time comparison).
  const isValid =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!isValid) {
    next(new AppError("Invalid API key", 401));
    return;
  }

  next();
};
