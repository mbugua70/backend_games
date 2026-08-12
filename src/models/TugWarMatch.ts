import { Document, Schema, Types, model } from "mongoose";
import {
  TUGWAR_MATCH_STATUSES,
  TUGWAR_PILLARS,
  TUGWAR_WINNERS,
  TugWarMatchStatus,
  TugWarPillar,
  TugWarWinner,
} from "../types/tugwar.types";

export interface TugWarMatchSide {
  playerId: Types.ObjectId;
  name: string;
  pillar: TugWarPillar;
}

export interface TugWarMatchDocument extends Document {
  sessionId: string;
  left: TugWarMatchSide;
  right: TugWarMatchSide;
  leftScore: number;
  rightScore: number;
  winnerSide: TugWarWinner | null;
  durationMs: number;
  status: TugWarMatchStatus;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const tugWarMatchSideSchema = new Schema<TugWarMatchSide>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "TugWarPlayer", required: true },
    name: { type: String, required: true, trim: true },
    pillar: { type: String, enum: TUGWAR_PILLARS, required: true },
  },
  { _id: false }
);

const tugWarMatchSchema = new Schema<TugWarMatchDocument>(
  {
    // Opaque correlation id the frontend carries from /start through to
    // /:sessionId/finish - same pattern as online_rubuspuzzle's Score.sessionId.
    sessionId: { type: String, required: true, unique: true },
    left: { type: tugWarMatchSideSchema, required: true },
    right: { type: tugWarMatchSideSchema, required: true },
    leftScore: { type: Number, default: 0 },
    rightScore: { type: Number, default: 0 },
    winnerSide: { type: String, enum: TUGWAR_WINNERS, default: null },
    durationMs: { type: Number, default: 0 },
    status: { type: String, enum: TUGWAR_MATCH_STATUSES, default: "in_progress" },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const TugWarMatch = model<TugWarMatchDocument>(
  "TugWarMatch",
  tugWarMatchSchema,
  "tugwar_matches"
);
