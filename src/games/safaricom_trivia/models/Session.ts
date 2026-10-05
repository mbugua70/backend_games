import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";
import "./Player";

export const SESSION_STATUSES = ["IN_PROGRESS", "COMPLETED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// The questions drawn for this session, in play order, snapshotted whole
// at draw time - a later admin edit to a question (rewording it, replacing
// its options) must never change what an already-started game shows on
// resume or how it scores.
export interface SessionQuestionOption {
  optionId: Types.ObjectId;
  text: string;
}

export interface SessionQuestion {
  questionId: Types.ObjectId;
  text: string;
  options: SessionQuestionOption[];
  correctOptionId: Types.ObjectId;
}

// Written once, on submit. selectedOptionId null = skipped (timed out).
export interface SessionAnswer {
  questionId: Types.ObjectId;
  selectedOptionId: Types.ObjectId | null;
  isCorrect: boolean;
}

export interface SessionDocument extends Document {
  organizationId: Types.ObjectId;
  playerId: Types.ObjectId;
  status: SessionStatus;
  questions: Types.DocumentArray<SessionQuestion>;
  answers: Types.DocumentArray<SessionAnswer>;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  scorePercent: number;
  // Snapshotted from GameConfig at start, so changing the config mid-event
  // doesn't retroactively make an in-progress game late.
  totalTimeLimitMs: number;
  // True when submit arrived after startedAt + totalTimeLimitMs (plus a
  // grace period). The score is still recorded rather than rejected - a
  // slow event network shouldn't wipe out a real game - but admins can see
  // and filter these.
  isLate: boolean;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessionQuestionOptionSchema = new Schema<SessionQuestionOption>(
  {
    optionId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const sessionQuestionSchema = new Schema<SessionQuestion>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    options: { type: [sessionQuestionOptionSchema], required: true },
    correctOptionId: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const sessionAnswerSchema = new Schema<SessionAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    selectedOptionId: { type: Schema.Types.ObjectId, default: null },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const sessionSchema = new Schema<SessionDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "SafaricomTriviaPlayer", required: true },
    status: { type: String, enum: SESSION_STATUSES, required: true, default: "IN_PROGRESS" },
    questions: { type: [sessionQuestionSchema], required: true, default: [] },
    answers: { type: [sessionAnswerSchema], required: true, default: [] },
    correctCount: { type: Number, required: true, default: 0 },
    wrongCount: { type: Number, required: true, default: 0 },
    skippedCount: { type: Number, required: true, default: 0 },
    scorePercent: { type: Number, required: true, default: 0 },
    totalTimeLimitMs: { type: Number, required: true },
    isLate: { type: Boolean, required: true, default: false },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Each player plays exactly once, ever - so a player has at most one
// session. Unique rather than app-checked so two simultaneous "start game"
// taps can't create two sessions with different questions.
sessionSchema.index({ playerId: 1 }, { unique: true });
sessionSchema.index({ organizationId: 1, status: 1, scorePercent: -1, completedAt: 1 });
sessionSchema.index({ organizationId: 1, createdAt: -1 });

export const Session = model<SessionDocument>(
  "SafaricomTriviaSession",
  sessionSchema,
  "safaricom_trivia_sessions"
);
