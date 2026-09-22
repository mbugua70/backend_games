import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";
import { Dimension, DIMENSIONS } from "./Question";
import "./Participant";

export const SESSION_STATUSES = ["IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// Embedded on the session (like GameSession.shots elsewhere in this repo)
// rather than a separate collection, so "one response per question" is a
// single atomic document update (see services/response.service.ts) instead
// of needing a Mongoose transaction this codebase has no existing pattern
// for. dimension and score are snapshotted at answer time from the
// Question/AnswerOption that was live then - later edits to that question
// must never change what an already-answered response scored.
export interface Response {
  _id: Types.ObjectId;
  questionId: Types.ObjectId;
  answerOptionId: Types.ObjectId;
  dimension: Dimension;
  score: number;
  answeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument extends Document {
  organizationId: Types.ObjectId;
  participantId: Types.ObjectId;
  status: SessionStatus;
  responses: Types.DocumentArray<Response>;
  startedAt: Date;
  completedAt: Date | null;
  idempotencyKey: string | null;
  // Lead-capture: which "next frontier" dimension(s) the CEO said they want
  // to explore further on the post-result CTA screen, so an org's admin can
  // follow up on the right topic - see services/session.service.ts's
  // submitInterest. Empty/null until (and unless) that screen is submitted.
  interestedFrontiers: Dimension[];
  interestSubmittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const responseSchema = new Schema<Response>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    answerOptionId: { type: Schema.Types.ObjectId, required: true },
    dimension: { type: String, enum: DIMENSIONS, required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    answeredAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const sessionSchema = new Schema<SessionDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    participantId: {
      type: Schema.Types.ObjectId,
      ref: "SafaricomCeoParticipant",
      required: true,
    },
    status: {
      type: String,
      enum: SESSION_STATUSES,
      required: true,
      default: "IN_PROGRESS",
    },
    responses: { type: [responseSchema], required: true, default: [] },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, default: null },
    idempotencyKey: { type: String, default: null },
    interestedFrontiers: { type: [String], enum: DIMENSIONS, default: [] },
    interestSubmittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ organizationId: 1, participantId: 1 });
sessionSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
sessionSchema.index({ organizationId: 1, completedAt: -1 });
sessionSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const Session = model<SessionDocument>(
  "SafaricomCeoSession",
  sessionSchema,
  "safaricom_ceo_sessions"
);
