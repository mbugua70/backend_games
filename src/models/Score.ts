import { Document, Schema, Types, model } from "mongoose";

export interface ScoreAnswer {
  puzzleId: string;
  selected: string | null;
  correct: boolean;
  timedOut: boolean;
}

export interface ScoreDocument extends Document {
  sessionId: string;
  player: Types.ObjectId;
  staffId: string;
  name: string;
  score: number;
  correctCount: number;
  totalPuzzles: number;
  durationMs: number;
  answers: ScoreAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

const scoreAnswerSchema = new Schema<ScoreAnswer>(
  {
    puzzleId: { type: String, required: true },
    selected: { type: String, default: null },
    correct: { type: Boolean, required: true },
    timedOut: { type: Boolean, required: true },
  },
  { _id: false }
);

const scoreSchema = new Schema<ScoreDocument>(
  {
    // Same id the frontend got back from /api/players/login for this
    // playthrough - unique so a "Retry" after a failed submit upserts
    // instead of creating a duplicate row.
    sessionId: { type: String, required: true, unique: true },
    player: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    staffId: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    totalPuzzles: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    answers: { type: [scoreAnswerSchema], default: [] },
  },
  { timestamps: true }
);

export const Score = model<ScoreDocument>("Score", scoreSchema, "scores");
