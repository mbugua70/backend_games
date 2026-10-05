import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

// Embedded rather than a separate collection: an option only ever exists
// alongside its question, same reasoning as safaricom_ceo's AnswerOption.
// Mongoose gives each option its own _id, which is what correctOptionId
// points at.
export interface AnswerOption {
  _id: Types.ObjectId;
  text: string;
}

export interface QuestionDocument extends Document {
  organizationId: Types.ObjectId;
  text: string;
  options: Types.DocumentArray<AnswerOption>;
  correctOptionId: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const answerOptionSchema = new Schema<AnswerOption>({
  text: { type: String, required: true, trim: true },
});

const questionSchema = new Schema<QuestionDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    text: { type: String, required: true, trim: true },
    options: { type: [answerOptionSchema], required: true, default: [] },
    // Must reference one of this question's own options - enforced in
    // services/question.service.ts, since Mongoose can't express "points
    // into a sibling array" as a schema constraint.
    correctOptionId: { type: Schema.Types.ObjectId, required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

// The draw in services/session.service.ts filters on exactly these two.
questionSchema.index({ organizationId: 1, isActive: 1 });

export const Question = model<QuestionDocument>(
  "SafaricomTriviaQuestion",
  questionSchema,
  "safaricom_trivia_questions"
);
