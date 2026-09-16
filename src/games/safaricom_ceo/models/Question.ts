import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

export const DIMENSIONS = [
  "VISIBILITY",
  "EFFICIENCY",
  "CONNECTEDNESS",
  "RESILIENCE",
  "INTELLIGENCE",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

// Embedded rather than a separate collection: an option only ever exists
// alongside its question (created/edited together by the admin, read
// together by every consumer), so this mirrors GameConfig.difficultyTiers
// elsewhere in this repo rather than adding a cross-collection join for a
// fixed cardinality (exactly 5) child list. Mongoose still gives each
// option its own _id, satisfying the spec's "id" field.
export interface AnswerOption {
  _id: Types.ObjectId;
  text: string;
  // Hidden score 1-5. Never serialize this to a participant-facing
  // response (see services/question.service.ts's toPublicQuestion).
  level: number;
  order: number;
  isActive: boolean;
}

export interface QuestionDocument extends Document {
  organizationId: Types.ObjectId;
  dimension: Dimension;
  text: string;
  order: number;
  isActive: boolean;
  options: Types.DocumentArray<AnswerOption>;
  createdAt: Date;
  updatedAt: Date;
}

const answerOptionSchema = new Schema<AnswerOption>({
  text: { type: String, required: true, trim: true },
  level: { type: Number, required: true, min: 1, max: 5 },
  order: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, required: true, default: true },
});

const questionSchema = new Schema<QuestionDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    dimension: { type: String, enum: DIMENSIONS, required: true },
    text: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, required: true, default: false },
    options: { type: [answerOptionSchema], required: true, default: [] },
  },
  { timestamps: true }
);

// Each dimension currently maps to exactly one question per org.
questionSchema.index({ organizationId: 1, dimension: 1 }, { unique: true });
// "Question order must be unique for active playable questions" - a
// partial unique index (rather than an app-only check) so the constraint
// holds even under concurrent admin edits; inactive/draft questions are
// free to share an order value while being authored.
questionSchema.index(
  { organizationId: 1, order: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const Question = model<QuestionDocument>(
  "SafaricomCeoQuestion",
  questionSchema,
  "safaricom_ceo_questions"
);
