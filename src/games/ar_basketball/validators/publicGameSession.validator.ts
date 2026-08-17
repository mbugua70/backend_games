import { z } from "zod";

export const startSessionSchema = z.object({
  // Client-generated - see gameSession.service.startSession for why
  // (offline-safe retries need the tablet to pick this, not the server).
  sessionUuid: z.string().uuid("Invalid session id"),
  // Required when the event's RegistrationConfig is in "registered"
  // playerMode; omitted for "guest" mode - startSession() enforces which
  // one applies, since that's config the client can't be trusted to
  // know/send.
  playerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid player id")
    .optional(),
});

const shotSchema = z.object({
  result: z.enum(["made", "missed"]),
  touchedRim: z.boolean(),
  touchedBackboard: z.boolean(),
  distanceMeters: z.coerce.number().min(0),
  shotAt: z.coerce.date().optional(),
});

export const completeSessionSchema = z.object({
  shots: z.array(shotSchema).min(1),
  // Raw client-calculated total, kept only for audit/mismatch logging -
  // completeSession() always recomputes the authoritative score itself.
  submittedScore: z.coerce.number().int().min(0).optional(),
});
