import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin";
import { AppError } from "../utils/AppError";
import { signAdminToken } from "../utils/jwt";

export interface AdminLoginResult {
  token: string;
  email: string;
}

// Same message for "no such admin" and "wrong password" - don't leak which one was wrong.
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export const loginAdmin = async (email: string, password: string): Promise<AdminLoginResult> => {
  const admin = await Admin.findOne({ email });
  if (!admin) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatches) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const token = signAdminToken(String(admin._id));
  return { token, email: admin.email };
};

export const getAdminEmailById = async (adminId: string): Promise<string> => {
  const admin = await Admin.findById(adminId);
  if (!admin) {
    throw new AppError("Admin account no longer exists", 401);
  }
  return admin.email;
};
