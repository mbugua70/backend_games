import { POINTS_PER_CORRECT, QUESTION_DURATION_MS } from "../config/constants";
import { logger } from "../logger/logger";
import { GameSession, GameSessionDocument } from "../models/GameSession";
import { GameStatePayload, GameStatus, Role } from "../types/game.types";
import { AppError } from "../utils/AppError";
import { generateUniqueGameCode } from "../utils/gameCode";

const PUZZLE_ACTIVE_STATUSES: GameStatus[] = [
  "playing",
  "correct",
  "wrong",
  "timeout",
  "revealed",
];

const toGameStatePayload = (doc: GameSessionDocument): GameStatePayload => ({
  gameCode: doc.gameCode,
  status: doc.status,
  puzzleIds: doc.puzzleIds,
  currentPuzzleIndex: doc.currentPuzzleIndex,
  currentPuzzleId: doc.puzzleIds[doc.currentPuzzleIndex] ?? null,
  score: doc.score,
  correctCount: doc.correctCount,
  wrongCount: doc.wrongCount,
  skippedCount: doc.skippedCount,
  timeoutCount: doc.timeoutCount,
  revealedCount: doc.revealedCount,
  currentPuzzleAnswered: doc.currentPuzzleAnswered,
  questionStartedAt: doc.questionStartedAt?.toISOString() ?? null,
  questionEndsAt: doc.questionEndsAt?.toISOString() ?? null,
  startedAt: doc.startedAt?.toISOString() ?? null,
  finishedAt: doc.finishedAt?.toISOString() ?? null,
  facilitatorConnected: doc.facilitatorConnected,
  displayConnected: doc.displayConnected,
});

const findSessionOrThrow = async (
  gameCode: string
): Promise<GameSessionDocument> => {
  const session = await GameSession.findOne({ gameCode });
  if (!session) {
    throw new AppError("Game not found", 404);
  }
  return session;
};

const assertStatus = (
  doc: GameSessionDocument,
  allowed: GameStatus[],
  action: string
): void => {
  if (!allowed.includes(doc.status)) {
    throw new AppError(`Cannot ${action} while game is "${doc.status}"`, 400);
  }
};

/** Advances to the next puzzle, or finishes the game if none remain. */
const applyAdvance = (doc: GameSessionDocument): void => {
  const nextIndex = doc.currentPuzzleIndex + 1;
  if (nextIndex >= doc.puzzleIds.length) {
    doc.status = "finished";
    doc.finishedAt = new Date();
    logger.info({ gameCode: doc.gameCode }, "Game finished");
    return;
  }
  doc.currentPuzzleIndex = nextIndex;
  doc.status = "playing";
  doc.currentPuzzleAnswered = false;
  doc.questionStartedAt = new Date();
  doc.questionEndsAt = new Date(Date.now() + QUESTION_DURATION_MS);
};

export const createGame = async (
  puzzleIds: string[]
): Promise<GameStatePayload> => {
  const gameCode = await generateUniqueGameCode();
  const doc = await GameSession.create({ gameCode, puzzleIds });
  logger.info({ gameCode }, "Game created");
  return toGameStatePayload(doc);
};

export const getGame = async (gameCode: string): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  return toGameStatePayload(doc);
};

export const deleteGame = async (gameCode: string): Promise<void> => {
  const result = await GameSession.findOneAndDelete({ gameCode });
  if (!result) {
    throw new AppError("Game not found", 404);
  }
  logger.info({ gameCode }, "Game deleted");
};

export const setConnectionStatus = async (
  gameCode: string,
  role: Role,
  connected: boolean
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  if (role === "facilitator") {
    doc.facilitatorConnected = connected;
  } else {
    doc.displayConnected = connected;
  }
  await doc.save();
  return toGameStatePayload(doc);
};

export const startGame = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, ["waiting"], "start the game");

  doc.status = "playing";
  doc.startedAt = new Date();
  doc.currentPuzzleIndex = 0;
  doc.currentPuzzleAnswered = false;
  doc.questionStartedAt = new Date();
  doc.questionEndsAt = new Date(Date.now() + QUESTION_DURATION_MS);

  await doc.save();
  logger.info({ gameCode }, "Game started");
  return toGameStatePayload(doc);
};

export const pauseGame = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, ["playing"], "pause the game");

  doc.status = "paused";
  await doc.save();
  logger.info({ gameCode }, "Game paused");
  return toGameStatePayload(doc);
};

/**
 * remainingMs is computed by the socket layer's timer manager (questionEndsAt
 * minus the moment it was paused) so the countdown resumes accurately without
 * the DB needing a dedicated "paused duration" field.
 */
export const resumeGame = async (
  gameCode: string,
  remainingMs: number
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, ["paused"], "resume the game");

  doc.status = "playing";
  doc.questionEndsAt = new Date(Date.now() + remainingMs);
  await doc.save();
  logger.info({ gameCode }, "Game resumed");
  return toGameStatePayload(doc);
};

export const judgeAnswer = async (
  gameCode: string,
  result: "correct" | "wrong"
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, ["playing"], "judge the answer");

  doc.currentPuzzleAnswered = true;
  doc.status = result;
  if (result === "correct") {
    doc.score += POINTS_PER_CORRECT;
    doc.correctCount += 1;
  } else {
    doc.wrongCount += 1;
  }

  await doc.save();
  logger.info({ gameCode, result }, "Puzzle judged");
  return toGameStatePayload(doc);
};

export const revealAnswer = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, ["playing"], "reveal the answer");

  doc.currentPuzzleAnswered = true;
  doc.status = "revealed";
  doc.revealedCount += 1;

  await doc.save();
  logger.info({ gameCode }, "Answer revealed");
  return toGameStatePayload(doc);
};

export const skipPuzzle = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, PUZZLE_ACTIVE_STATUSES, "skip the puzzle");

  if (doc.status === "playing") {
    doc.skippedCount += 1;
  }
  applyAdvance(doc);

  await doc.save();
  return toGameStatePayload(doc);
};

const RETRYABLE_STATUSES: GameStatus[] = ["wrong", "timeout"];

/**
 * Replays the current puzzle for the next player in line - used when the
 * answer was wrong or the timer ran out, so only a correct answer (via
 * skipPuzzle/nextPuzzle) advances the puzzle index.
 */
export const retryPuzzle = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, RETRYABLE_STATUSES, "retry the puzzle");

  doc.status = "playing";
  doc.currentPuzzleAnswered = false;
  doc.questionStartedAt = new Date();
  doc.questionEndsAt = new Date(Date.now() + QUESTION_DURATION_MS);

  await doc.save();
  logger.info({ gameCode }, "Puzzle retried for next player");
  return toGameStatePayload(doc);
};

export const nextPuzzle = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, PUZZLE_ACTIVE_STATUSES, "advance to the next puzzle");

  applyAdvance(doc);

  await doc.save();
  return toGameStatePayload(doc);
};

/** Timer-driven, not user-initiated: stale firings are a silent no-op. */
export const timeoutQuestion = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  if (doc.status === "playing") {
    doc.currentPuzzleAnswered = true;
    doc.status = "timeout";
    doc.timeoutCount += 1;
    await doc.save();
  }
  return toGameStatePayload(doc);
};

export const finishGame = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  if (doc.status !== "finished") {
    doc.status = "finished";
    doc.finishedAt = new Date();
    await doc.save();
    logger.info({ gameCode }, "Game finished");
  }
  return toGameStatePayload(doc);
};

const shuffle = <T,>(list: T[]): T[] => {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
};

/** Reorders the puzzle lineup for the *next* round - only allowed before a round is live. */
export const shuffleOrder = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);
  assertStatus(doc, ["waiting", "finished"], "shuffle the puzzle order");

  doc.puzzleIds = shuffle(doc.puzzleIds);

  await doc.save();
  logger.info({ gameCode }, "Puzzle order shuffled");
  return toGameStatePayload(doc);
};

export const restartGame = async (
  gameCode: string
): Promise<GameStatePayload> => {
  const doc = await findSessionOrThrow(gameCode);

  doc.status = "waiting";
  doc.currentPuzzleIndex = 0;
  doc.score = 0;
  doc.correctCount = 0;
  doc.wrongCount = 0;
  doc.skippedCount = 0;
  doc.timeoutCount = 0;
  doc.revealedCount = 0;
  doc.currentPuzzleAnswered = false;
  doc.questionStartedAt = null;
  doc.questionEndsAt = null;
  doc.startedAt = null;
  doc.finishedAt = null;

  await doc.save();
  logger.info({ gameCode }, "Game restarted");
  return toGameStatePayload(doc);
};
