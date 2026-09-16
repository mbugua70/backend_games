import { z } from "zod";
import { objectIdSchema } from "./common.validator";

// Digits, spaces, +, -, parentheses only - deliberately not Kenya-only
// formatting, per the spec ("support phone numbers without forcing the
// entire system to Kenya-only formatting").
const phoneNumberSchema = z
  .string()
  .trim()
  .min(7, "phoneNumber is too short")
  .max(20, "phoneNumber is too long")
  .regex(/^[0-9+()\-\s]+$/, "phoneNumber may only contain digits, spaces, +, -, and parentheses");

export const registerParticipantSchema = z.object({
  phoneNumber: phoneNumberSchema,
  businessName: z.string().trim().min(1, "businessName is required").max(200),
  email: z.string().trim().toLowerCase().email("Invalid email address").max(200),
  businessType: z.string().trim().min(1, "businessType is required").max(100),
  numberOfEmployees: z.string().trim().min(1, "numberOfEmployees is required").max(50),
});

export type RegisterParticipantInput = z.infer<typeof registerParticipantSchema>;

export const participantIdParamSchema = z.object({
  participantId: objectIdSchema("participant id"),
});
