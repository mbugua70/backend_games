import { z } from "zod";
import { GAME_CODE_ALPHABET, GAME_CODE_LENGTH } from "../config/constants";

const gameCodePattern = new RegExp(`^[${GAME_CODE_ALPHABET}]{${GAME_CODE_LENGTH}}$`);

export const gameCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(gameCodePattern, "Invalid game code");

export const roleSchema = z.enum(["display", "facilitator"]);

// REST: POST /api/game-sessions
export const createSessionSchema = z.object({
  puzzleIds: z
    .array(z.string().trim().min(1, "Puzzle id cannot be empty"))
    .min(1, "At least one puzzle is required"),
});

// REST: GET/DELETE /api/game-sessions/:gameCode
export const gameCodeParamSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:join
export const joinSchema = z.object({
  gameCode: gameCodeSchema,
  role: roleSchema,
});

// Socket: game:start
export const startGameSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:pause
export const pauseGameSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:resume
export const resumeGameSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:skip
export const skipPuzzleSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:retry
export const retryPuzzleSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:redirect-display
export const redirectDisplaySchema = z.object({
  gameCode: gameCodeSchema,
  newGameCode: gameCodeSchema,
});

// Socket: game:restart
export const restartGameSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:end
export const endGameSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:judge
export const judgeAnswerSchema = z.object({
  gameCode: gameCodeSchema,
  result: z.enum(["correct", "wrong"]),
});

// Socket: game:reveal
export const revealAnswerSchema = z.object({
  gameCode: gameCodeSchema,
});

// Socket: game:shuffle
export const shuffleOrderSchema = z.object({
  gameCode: gameCodeSchema,
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type GameCodeParamInput = z.infer<typeof gameCodeParamSchema>;
export type JoinInput = z.infer<typeof joinSchema>;
export type StartGameInput = z.infer<typeof startGameSchema>;
export type PauseGameInput = z.infer<typeof pauseGameSchema>;
export type ResumeGameInput = z.infer<typeof resumeGameSchema>;
export type SkipPuzzleInput = z.infer<typeof skipPuzzleSchema>;
export type RetryPuzzleInput = z.infer<typeof retryPuzzleSchema>;
export type RedirectDisplayInput = z.infer<typeof redirectDisplaySchema>;
export type RestartGameInput = z.infer<typeof restartGameSchema>;
export type EndGameInput = z.infer<typeof endGameSchema>;
export type JudgeAnswerInput = z.infer<typeof judgeAnswerSchema>;
export type RevealAnswerInput = z.infer<typeof revealAnswerSchema>;
export type ShuffleOrderInput = z.infer<typeof shuffleOrderSchema>;
