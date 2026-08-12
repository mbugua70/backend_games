import { randomUUID } from "node:crypto";
import { Document, Schema, Types, model } from "mongoose";
import "./Event";
import "./Player";

export type GameSessionStatus = "in_progress" | "completed";

// Snapshotted from GameConfig.difficultyTiers at session-start time, not
// referenced live - so a later admin edit to that event's tiers never
// changes the difficulty a past session was actually played at.
export interface DifficultySnapshot {
  key: string;
  label: string;
  pieceCount: number;
  timeLimitSeconds: number;
}

export interface GameSessionDocument extends Document {
  uuid: string;
  eventId: Types.ObjectId;
  playerId: Types.ObjectId | null;
  difficulty: DifficultySnapshot;
  status: GameSessionStatus;
  moves: number;
  hintsUsed: number;
  score: number | null;
  // Stored (not derived from completedAt - createdAt on read) so the
  // leaderboard's duration ASC tie-break can be a plain indexed sort
  // instead of an aggregation on every query.
  durationSeconds: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const difficultySnapshotSchema = new Schema<DifficultySnapshot>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    pieceCount: { type: Number, required: true },
    timeLimitSeconds: { type: Number, required: true },
  },
  { _id: false }
);

const gameSessionSchema = new Schema<GameSessionDocument>(
  {
    // Public-facing id for the game client (step 9's endpoints reference
    // sessions by this, not the Mongo _id) - a v4 UUID doesn't leak
    // creation order or count the way a sequential/ObjectId reference would.
    uuid: { type: String, required: true, unique: true, default: () => randomUUID() },
    eventId: { type: Schema.Types.ObjectId, ref: "JigsawPuzzleEvent", required: true },
    // Nullable: a session can start before/without a completed player
    // registration.
    playerId: { type: Schema.Types.ObjectId, ref: "JigsawPuzzlePlayer", default: null },
    difficulty: { type: difficultySnapshotSchema, required: true },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      required: true,
      default: "in_progress",
    },
    moves: { type: Number, required: true, default: 0, min: 0 },
    hintsUsed: { type: Number, required: true, default: 0, min: 0 },
    score: { type: Number, default: null, min: 0 },
    durationSeconds: { type: Number, default: null, min: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

gameSessionSchema.index({ eventId: 1, createdAt: -1 });
// Matches the leaderboard's query shape: completed sessions for an event,
// sorted score DESC / durationSeconds ASC.
gameSessionSchema.index({ eventId: 1, status: 1, score: -1, durationSeconds: 1 });

export const GameSession = model<GameSessionDocument>(
  "JigsawPuzzleGameSession",
  gameSessionSchema,
  "jigsaw_puzzle_game_sessions"
);
