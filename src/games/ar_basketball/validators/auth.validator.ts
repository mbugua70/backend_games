import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).toLowerCase(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
