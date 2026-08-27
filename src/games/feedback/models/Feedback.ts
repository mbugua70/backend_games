import { Document, Schema, model } from "mongoose";

// Field shape is dictated by the kakan website's feedback questionnaire
// (kakan/src/components/feedback/*Step.jsx) - this backend just stores
// whatever that form collects, same as jigsaw_puzzle not owning puzzle
// content. Keep the two in sync if the form's steps ever change.
export interface FeedbackDocument extends Document {
  name: string;
  phone: string;
  profession?: string;
  location: string;
  wantsBetterTuwan: boolean;
  areasToImprove: string[];
  additionalComment?: string;
  consentToDataCollection: boolean;
  consentToUpdates: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<FeedbackDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    profession: { type: String, trim: true, maxlength: 200 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    wantsBetterTuwan: { type: Boolean, required: true },
    areasToImprove: { type: [String], default: [] },
    additionalComment: { type: String, trim: true, maxlength: 5000 },
    consentToDataCollection: { type: Boolean, required: true },
    consentToUpdates: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

export const Feedback = model<FeedbackDocument>(
  "CustomerFeedback",
  feedbackSchema,
  "customer_feedback"
);
