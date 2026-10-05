import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
