import { z } from "zod";

// REST: POST /api/players/login
export const loginSchema = z.object({
  staffId: z.string().trim().min(1, "Staff ID is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(80),
});

export type LoginInput = z.infer<typeof loginSchema>;
