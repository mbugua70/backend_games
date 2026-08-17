import bcrypt from "bcryptjs";
import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";
import { signToken, verifyToken } from "../../../core/utils/authToken";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { Admin } from "../models/Admin";

interface LoginInput {
  username: string;
  password: string;
}

interface AdminSummary {
  id: string;
  username: string;
  organizationId: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  admin: AdminSummary;
}

const toAdminSummary = (payload: Pick<AdminTokenPayload, "adminId" | "username" | "organizationId">): AdminSummary => ({
  id: payload.adminId,
  username: payload.username,
  organizationId: payload.organizationId,
});

export const login = async (input: LoginInput): Promise<LoginResult> => {
  const admin = await Admin.findOne({ username: input.username });
  if (!admin) {
    throw new AppError("Invalid username or password", 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, admin.passwordHash);
  if (!passwordMatches) {
    throw new AppError("Invalid username or password", 401);
  }

  const basePayload = {
    adminId: admin._id.toString(),
    organizationId: admin.organizationId.toString(),
    username: admin.username,
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
    admin: toAdminSummary(basePayload),
  };
};

// Verifies a refresh token, re-fetches the Admin (so a deleted/deactivated
// admin can't refresh), and issues a new access token only - the refresh
// token itself is not rotated, since this is a fully stateless design with
// no server-side refresh-token storage/revocation.
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
  if (!admin) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const accessToken = signToken(
    {
      adminId: admin._id.toString(),
      organizationId: admin.organizationId.toString(),
      username: admin.username,
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
    username: admin.username,
    organizationId: admin.organizationId.toString(),
  };
};
