import { z } from "zod";

export const registerPlayerSchema = z.object({
  registrationData: z.record(z.string(), z.string()).default({}),
});
