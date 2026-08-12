import bcrypt from "bcryptjs";
import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";
import { signToken } from "../../../core/utils/authToken";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { Admin } from "../models/Admin";

interface LoginInput {
  username: string;
  password: string;
}

interface LoginResult {
  token: string;
  admin: {
    id: string;
    username: string;
    organizationId: string;
  };
}

export const login = async (input: LoginInput): Promise<LoginResult> => {
  const admin = await Admin.findOne({ username: input.username });
  if (!admin) {
    throw new AppError("Invalid username or password", 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, admin.passwordHash);
  if (!passwordMatches) {
    throw new AppError("Invalid username or password", 401);
  }

  const payload: AdminTokenPayload = {
    adminId: admin._id.toString(),
    organizationId: admin.organizationId.toString(),
    username: admin.username,
  };

  const token = signToken(payload, env.JWT_SECRET, env.JWT_EXPIRES_IN);

  return {
    token,
    admin: {
      id: payload.adminId,
      username: payload.username,
      organizationId: payload.organizationId,
    },
  };
};
