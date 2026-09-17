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

// name is the only required registration field - everything else is
// optional so the form can be filled in partially at a busy event.
export const registerParticipantSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  phoneNumber: phoneNumberSchema.optional(),
  businessName: z.string().trim().min(1, "businessName is required").max(200).optional(),
  email: z.string().trim().toLowerCase().email("Invalid email address").max(200).optional(),
  businessType: z.string().trim().min(1, "businessType is required").max(100).optional(),
  numberOfEmployees: z.string().trim().min(1, "numberOfEmployees is required").max(50).optional(),
});

export type RegisterParticipantInput = z.infer<typeof registerParticipantSchema>;

export const participantIdParamSchema = z.object({
  participantId: objectIdSchema("participant id"),
});
