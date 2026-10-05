import { z } from "zod";

// Format is checked loosely here and properly in services/phone.ts's
// normalizeKenyanPhone, which is what decides whether two inputs are the
// same number.
export const registerPlayerSchema = z.object({
  name: z.string({ error: "Please insert name" }).trim().min(1, "Please insert name").max(100),
  phone: z
    .string({ error: "Please insert phone number" })
    .trim()
    .min(1, "Please insert phone number")
    .max(20, "Please insert correct phone number"),
});

export type RegisterPlayerInput = z.infer<typeof registerPlayerSchema>;
