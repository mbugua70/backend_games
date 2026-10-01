import { z } from "zod";

export const registerParticipantSchema = z.object({
  fields: z.record(z.string(), z.string().trim()).default({}),
  consentAccepted: z.boolean().optional().default(false),
});
