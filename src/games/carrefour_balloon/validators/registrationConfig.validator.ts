import { z } from "zod";

const registrationFieldSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["text", "email", "phone", "number", "select"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1)).optional(),
});

export const updateRegistrationConfigSchema = z.object({
  fields: z.array(registrationFieldSchema),
  consentText: z.string().trim().nullable().optional(),
});
