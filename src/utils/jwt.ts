import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AdminTokenPayload {
  adminId: string;
}

export const signAdminToken = (adminId: string): string =>
  jwt.sign({ adminId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

/** Throws (jsonwebtoken's TokenExpiredError/JsonWebTokenError) on an invalid or expired token - callers let that propagate to the error handler. */
export const verifyAdminToken = (token: string): AdminTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null || typeof decoded.adminId !== "string") {
    throw new Error("Malformed admin token payload");
  }
  return { adminId: decoded.adminId };
};
