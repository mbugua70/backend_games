export const GAME_STATUSES = [
  "waiting",
  "countdown",
  "playing",
  "correct",
  "wrong",
  "timeout",
  "revealed",
  "paused",
  "finished",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export type Role = "display" | "facilitator";

/**
 * Single source of truth for "what the clients see" - this shape is used
 * both as the REST GET response body and the Socket.IO `game:state` payload.
 */
export interface GameStatePayload {
  gameCode: string;
  status: GameStatus;
  puzzleIds: string[];
  currentPuzzleIndex: number;
  currentPuzzleId: string | null;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeoutCount: number;
  revealedCount: number;
  currentPuzzleAnswered: boolean;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  facilitatorConnected: boolean;
  displayConnected: boolean;
}
