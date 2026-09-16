import { Document, Schema, Types, model } from "mongoose";
import { Dimension, DIMENSIONS } from "./Question";
import "./Session";
import "./Profile";

export interface DimensionScoreSnapshot {
  dimension: Dimension;
  score: number;
}

export interface SessionResultDocument extends Document {
  sessionId: Types.ObjectId;
  organizationId: Types.ObjectId;
  dimensionScores: DimensionScoreSnapshot[];
  totalScore: number;
  averageScore: number;
  strongestDimensions: Dimension[];
  weakestDimensions: Dimension[];
  // Nullable until the client has approved real profile-selection rules -
  // see services/profileResolver.service.ts. Never delete a Profile a
  // result references (see Profile.ts); deactivate it instead.
  profileId: Types.ObjectId | null;
  strengths: unknown;
  nextFrontier: unknown;
  ceoQuestion: string | null;
  // Which scoring/profile rules produced this row, so a later rules change
  // never silently reinterprets a historical result - see
  // services/scoring.service.ts's SCORING_VERSION.
  scoringVersion: string;
  createdAt: Date;
}

const dimensionScoreSchema = new Schema<DimensionScoreSnapshot>(
  {
    dimension: { type: String, enum: DIMENSIONS, required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false }
);

const sessionResultSchema = new Schema<SessionResultDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "SafaricomCeoSession", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    dimensionScores: { type: [dimensionScoreSchema], required: true },
    totalScore: { type: Number, required: true, min: 0 },
    averageScore: { type: Number, required: true, min: 0 },
    strongestDimensions: { type: [String], enum: DIMENSIONS, required: true },
    weakestDimensions: { type: [String], enum: DIMENSIONS, required: true },
    profileId: { type: Schema.Types.ObjectId, ref: "SafaricomCeoProfile", default: null },
    strengths: { type: Schema.Types.Mixed, default: null },
    nextFrontier: { type: Schema.Types.Mixed, default: null },
    ceoQuestion: { type: String, default: null },
    scoringVersion: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// "There must be only one result per session" - a DB-level constraint, not
// just an application check, so two concurrent completion requests can
// never create two rows (see services/session.service.ts's completeSession).
sessionResultSchema.index({ sessionId: 1 }, { unique: true });
sessionResultSchema.index({ organizationId: 1, profileId: 1 });
sessionResultSchema.index({ organizationId: 1, createdAt: -1 });

export const SessionResult = model<SessionResultDocument>(
  "SafaricomCeoSessionResult",
  sessionResultSchema,
  "safaricom_ceo_session_results"
);
