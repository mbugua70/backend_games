import { Document, Schema, model } from "mongoose";

export interface FeedbackDocument extends Document {
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<FeedbackDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

export const Feedback = model<FeedbackDocument>(
  "CustomerFeedback",
  feedbackSchema,
  "customer_feedback"
);
