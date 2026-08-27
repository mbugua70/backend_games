import { AppError } from "../../../core/utils/AppError";
import { Feedback, FeedbackDocument } from "../models/Feedback";

export interface FeedbackPayload {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackListPayload {
  items: FeedbackPayload[];
  page: number;
  limit: number;
  total: number;
}

const toFeedbackPayload = (feedback: FeedbackDocument): FeedbackPayload => ({
  id: feedback._id.toString(),
  name: feedback.name,
  email: feedback.email,
  message: feedback.message,
  createdAt: feedback.createdAt,
  updatedAt: feedback.updatedAt,
});

export const submitFeedback = async (input: {
  name: string;
  email: string;
  message: string;
}): Promise<FeedbackPayload> => {
  const feedback = await Feedback.create(input);
  return toFeedbackPayload(feedback);
};

export const listFeedback = async (
  page: number,
  limit: number
): Promise<FeedbackListPayload> => {
  const [items, total] = await Promise.all([
    Feedback.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Feedback.countDocuments(),
  ]);

  return { items: items.map(toFeedbackPayload), page, limit, total };
};

export const getFeedbackById = async (feedbackId: string): Promise<FeedbackPayload> => {
  const feedback = await Feedback.findById(feedbackId);
  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }
  return toFeedbackPayload(feedback);
};
