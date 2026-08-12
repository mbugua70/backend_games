import { Document, Schema, model } from "mongoose";
import { GAME_STATUSES, GameStatus } from "../types/game.types";

export interface GameSessionDocument extends Document {
  gameCode: string;
  status: GameStatus;
  puzzleIds: string[];
  currentPuzzleIndex: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeoutCount: number;
  revealedCount: number;
  currentPuzzleAnswered: boolean;
  questionStartedAt: Date | null;
  questionEndsAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  facilitatorConnected: boolean;
  displayConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gameSessionSchema = new Schema<GameSessionDocument>(
  {
    gameCode: { type: String, required: true, unique: true },
    status: { type: String, enum: GAME_STATUSES, default: "waiting" },
    puzzleIds: { type: [String], required: true, default: [] },
    currentPuzzleIndex: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    timeoutCount: { type: Number, default: 0 },
    revealedCount: { type: Number, default: 0 },
    currentPuzzleAnswered: { type: Boolean, default: false },
    questionStartedAt: { type: Date, default: null },
    questionEndsAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    facilitatorConnected: { type: Boolean, default: false },
    displayConnected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const GameSession = model<GameSessionDocument>(
  "GameSession",
  gameSessionSchema,
  "game_sessions"
);
