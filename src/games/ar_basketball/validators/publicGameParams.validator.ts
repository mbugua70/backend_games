import { z } from "zod";

// Shared by every public game-client validator file: code is the public
// lookup key for an event (entered in-app), and sessionUuid is
// GameSession.sessionUuid, not the Mongo _id admins use.
export const eventCodeParamSchema = z.object({
  code: z.string().trim().min(1).toLowerCase(),
});

export const sessionUuidParamSchema = z.object({
  sessionUuid: z.string().uuid("Invalid session id"),
});
