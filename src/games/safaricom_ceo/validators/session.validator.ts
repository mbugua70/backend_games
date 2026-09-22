import { z } from "zod";
import { DIMENSIONS } from "../models/Question";
import { objectIdSchema } from "./common.validator";

export const sessionIdParamSchema = z.object({
  sessionId: objectIdSchema("session id"),
});

export const startSessionSchema = z.object({
  participantId: objectIdSchema("participant id"),
});

export const submitInterestSchema = z.object({
  dimensions: z.array(z.enum(DIMENSIONS)).min(1, "At least one dimension is required"),
});
export type SubmitInterestInput = z.infer<typeof submitInterestSchema>;
