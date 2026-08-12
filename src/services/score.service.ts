import { logger } from "../logger/logger";
import { Player } from "../models/Player";
import { Score } from "../models/Score";
import { AppError } from "../utils/AppError";
import { SubmitScoreInput } from "../validators/score.validator";

export interface SubmitScoreResult {
  scoreId: string;
}

/**
 * Upserts on sessionId rather than inserting, so the frontend's "Retry"
 * button after a failed submit is safe to call again with the same
 * sessionId instead of creating a duplicate score row.
 */
export const submitScore = async (input: SubmitScoreInput): Promise<SubmitScoreResult> => {
  const player = await Player.findById(input.playerId).select("_id");
  if (!player) {
    throw new AppError("Unknown player - please log in again", 404);
  }

  const doc = await Score.findOneAndUpdate(
    { sessionId: input.sessionId },
    {
      sessionId: input.sessionId,
      player: player._id,
      staffId: input.staffId,
      name: input.name,
      score: input.score,
      correctCount: input.correctCount,
      totalPuzzles: input.totalPuzzles,
      durationMs: input.durationMs,
      answers: input.answers,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info(
    { sessionId: input.sessionId, staffId: input.staffId, score: input.score },
    "Score submitted"
  );

  return { scoreId: String(doc._id) };
};
