import { z } from "zod";

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});

export const playerIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
  playerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid player id"),
});
