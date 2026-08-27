import { AppError } from "../../../core/utils/AppError";
import { Feedback, FeedbackDocument } from "../models/Feedback";

export interface FeedbackPayload {
  id: string;
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

export interface FeedbackListPayload {
  items: FeedbackPayload[];
  page: number;
  limit: number;
  total: number;
}

export interface SubmitFeedbackInput {
  name: string;
  phone: string;
  profession?: string;
  location: string;
  wantsBetterTuwan: boolean;
  areasToImprove: string[];
  additionalComment?: string;
  consentToDataCollection: boolean;
  consentToUpdates: boolean;
}

const toFeedbackPayload = (feedback: FeedbackDocument): FeedbackPayload => ({
  id: feedback._id.toString(),
  name: feedback.name,
  phone: feedback.phone,
  profession: feedback.profession,
  location: feedback.location,
  wantsBetterTuwan: feedback.wantsBetterTuwan,
  areasToImprove: feedback.areasToImprove,
  additionalComment: feedback.additionalComment,
  consentToDataCollection: feedback.consentToDataCollection,
  consentToUpdates: feedback.consentToUpdates,
  createdAt: feedback.createdAt,
  updatedAt: feedback.updatedAt,
});

export const submitFeedback = async (
  input: SubmitFeedbackInput
): Promise<FeedbackPayload> => {
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

export const deleteFeedbackById = async (feedbackId: string): Promise<void> => {
  const feedback = await Feedback.findByIdAndDelete(feedbackId);
  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }
};
