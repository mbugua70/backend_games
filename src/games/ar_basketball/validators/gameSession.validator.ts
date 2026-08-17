import { z } from "zod";

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});

export const sessionIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid session id"),
});
