import { z } from "zod";
import { objectIdSchema } from "./common.validator";

export const sessionIdParamSchema = z.object({
  sessionId: objectIdSchema("session id"),
});

export const startSessionSchema = z.object({
  participantId: objectIdSchema("participant id"),
});
