import { nanoid } from "nanoid";
import { logger } from "../logger/logger";
import { Player } from "../models/Player";
import { AppError } from "../utils/AppError";

export interface LoginResult {
  playerId: string;
  sessionId: string;
  staffId: string;
  name: string;
}

const ALREADY_PLAYED_MESSAGE = "This staff ID has already played - only one attempt is allowed";

/** Narrows a caught error to a MongoDB duplicate-key error (E11000) without pulling in the driver's error type. */
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000;
}

/**
 * Upserts the player by staffId and marks them as having played, atomically:
 * the filter only matches a doc that doesn't exist yet or hasn't played yet,
 * so a staffId that's already played can't match-and-update - Mongo instead
 * tries to insert a duplicate and collides with the unique staffId index,
 * which we translate into a clean "already played" error below. Also mints
 * a fresh sessionId for this playthrough - there's no persisted "session"
 * document, sessionId is just an opaque correlation id the frontend carries
 * through to /api/scores/submit.
 */
export const loginPlayer = async (staffId: string, name: string): Promise<LoginResult> => {
  const normalizedStaffId = staffId.toUpperCase();

  let player;
  try {
    player = await Player.findOneAndUpdate(
      { staffId: normalizedStaffId, hasPlayed: { $ne: true } },
      { $set: { staffId: normalizedStaffId, name, hasPlayed: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(ALREADY_PLAYED_MESSAGE, 409);
    }
    throw err;
  }

  const sessionId = nanoid();
  logger.info({ staffId: normalizedStaffId, sessionId }, "Player logged in");

  return {
    playerId: String(player._id),
    sessionId,
    staffId: player.staffId,
    name: player.name,
  };
};
