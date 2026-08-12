// Pure and transport/DB-agnostic on purpose: no Express or Mongoose imports,
// so it's trivially unit-testable in isolation from the rest of the game
// session flow (step 12).

const POINTS_PER_PIECE = 100;
const TIME_PENALTY_PER_SECOND = 1;
const EXTRA_MOVE_PENALTY = 5;
const HINT_PENALTY = 50;

export interface ScoreInput {
  pieceCount: number;
  durationSeconds: number;
  moves: number;
  hintsUsed: number;
}

export const calculateScore = (input: ScoreInput): number => {
  const basePoints = input.pieceCount * POINTS_PER_PIECE;

  // pieceCount is the minimum number of moves a perfectly played puzzle
  // takes, so only moves beyond that are penalized.
  const extraMoves = Math.max(0, input.moves - input.pieceCount);

  const penalty =
    input.durationSeconds * TIME_PENALTY_PER_SECOND +
    extraMoves * EXTRA_MOVE_PENALTY +
    input.hintsUsed * HINT_PENALTY;

  return Math.max(0, Math.round(basePoints - penalty));
};
