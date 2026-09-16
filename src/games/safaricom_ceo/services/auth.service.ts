import bcrypt from "bcryptjs";
import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";
import { signToken, verifyToken } from "../../../core/utils/authToken";
import { Admin, AdminRole } from "../models/Admin";
import { AdminTokenPayload } from "../middleware/requireAdmin";

interface LoginInput {
  email: string;
  password: string;
}

interface AdminSummary {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  organizationId: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  admin: AdminSummary;
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export const login = async (input: LoginInput): Promise<LoginResult> => {
  const admin = await Admin.findOne({ email: input.email });
  if (!admin || !admin.isActive) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, admin.passwordHash);
  if (!passwordMatches) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const basePayload = {
    adminId: admin._id.toString(),
    organizationId: admin.organizationId.toString(),
    email: admin.email,
    role: admin.role,
  };

  const accessToken = signToken(
    { ...basePayload, type: "access" } satisfies AdminTokenPayload,
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN
  );
  const refreshToken = signToken(
    { ...basePayload, type: "refresh" } satisfies AdminTokenPayload,
    env.JWT_SECRET,
    env.ADMIN_REFRESH_TOKEN_EXPIRES_IN
  );

  return {
    accessToken,
    refreshToken,
    admin: {
      id: basePayload.adminId,
      name: admin.name,
      email: basePayload.email,
      role: basePayload.role,
      organizationId: basePayload.organizationId,
    },
  };
};

// Verifies a refresh token, re-fetches the Admin (so a deactivated admin
// can't refresh), and issues a new access token only. Fully stateless (no
// server-side refresh-token storage/rotation/revocation list) - matching
// ar_basketball's existing admin auth elsewhere in this repo, rather than
// adding new per-game infra. See auth.controller.ts's logout for what this
// tradeoff means for that endpoint.
export const refresh = async (refreshToken: string): Promise<{ accessToken: string }> => {
  let payload: AdminTokenPayload;
  try {
    payload = verifyToken<AdminTokenPayload>(refreshToken, env.JWT_SECRET);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (payload.type !== "refresh") {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const admin = await Admin.findById(payload.adminId);
  if (!admin || !admin.isActive) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const accessToken = signToken(
    {
      adminId: admin._id.toString(),
      organizationId: admin.organizationId.toString(),
      email: admin.email,
      role: admin.role,
      type: "access",
    } satisfies AdminTokenPayload,
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN
  );

  return { accessToken };
};

export const getMe = async (adminId: string): Promise<AdminSummary> => {
  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }
  return {
    id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    organizationId: admin.organizationId.toString(),
  };
};
