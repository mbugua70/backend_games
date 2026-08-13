import { z } from "zod";

export const startSessionSchema = z.object({
  playerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid player id"),
  // Only consulted when the event's GameConfig is in "player_choice" mode -
  // startSession() ignores this entirely in "fixed" mode, so a client can
  // never override a fixed event's difficulty by sending it anyway.
  difficultyKey: z.string().trim().min(1).optional(),
});

export const completeSessionSchema = z.object({
  moves: z.number().int().min(0),
  hintsUsed: z.number().int().min(0),
});
