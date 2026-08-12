import { nanoid } from "nanoid";
import { Types } from "mongoose";
import { logger } from "../logger/logger";
import { TugWarMatch, TugWarMatchSide } from "../models/TugWarMatch";
import { TugWarPlayer } from "../models/TugWarPlayer";
import { AppError } from "../utils/AppError";
import { FinishMatchInput, StartMatchInput } from "../validators/tugwar.validator";

export interface StartMatchResult {
  sessionId: string;
  matchId: string;
  left: TugWarMatchSide;
  right: TugWarMatchSide;
}

export interface FinishMatchResult {
  matchId: string;
}

/**
 * Creates the two player rows and their match in one go. The match's _id is
 * minted up front so it can be set as each player's matchId before the match
 * document itself (which embeds the players' ids) is created.
 */
export const startMatch = async (input: StartMatchInput): Promise<StartMatchResult> => {
  const matchId = new Types.ObjectId();
  const sessionId = nanoid();

  const [leftPlayer, rightPlayer] = await Promise.all([
    TugWarPlayer.create({ name: input.left.name, pillar: input.left.pillar, side: "left", matchId }),
    TugWarPlayer.create({ name: input.right.name, pillar: input.right.pillar, side: "right", matchId }),
  ]);

  const left: TugWarMatchSide = { playerId: leftPlayer._id, name: leftPlayer.name, pillar: leftPlayer.pillar };
  const right: TugWarMatchSide = { playerId: rightPlayer._id, name: rightPlayer.name, pillar: rightPlayer.pillar };

  await TugWarMatch.create({ _id: matchId, sessionId, left, right });

  logger.info({ sessionId, matchId: String(matchId) }, "Tug of War match started");

  return { sessionId, matchId: String(matchId), left, right };
};

export const finishMatch = async (
  sessionId: string,
  input: FinishMatchInput
): Promise<FinishMatchResult> => {
  const match = await TugWarMatch.findOneAndUpdate(
    { sessionId },
    {
      leftScore: input.leftScore,
      rightScore: input.rightScore,
      winnerSide: input.winnerSide,
      durationMs: input.durationMs,
      status: "finished",
      finishedAt: new Date(),
    },
    { new: true }
  );

  if (!match) {
    throw new AppError("Unknown match session - please start a new match", 404);
  }

  logger.info(
    { sessionId, winnerSide: input.winnerSide, leftScore: input.leftScore, rightScore: input.rightScore },
    "Tug of War match finished"
  );

  return { matchId: String(match._id) };
};
