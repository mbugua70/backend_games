import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as feedbackService from "../services/feedback.service";
import {
  createFeedbackSchema,
  feedbackIdParamSchema,
  listFeedbackQuerySchema,
} from "../validators/feedback.validator";

export const submitFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = createFeedbackSchema.parse(req.body);
  const feedback = await feedbackService.submitFeedback(input);
  sendSuccess(res, feedback, "Feedback submitted", 201);
});

export const listFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit } = listFeedbackQuerySchema.parse(req.query);
  const result = await feedbackService.listFeedback(page, limit);
  sendSuccess(res, result);
});

export const getFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { feedbackId } = feedbackIdParamSchema.parse(req.params);
  const feedback = await feedbackService.getFeedbackById(feedbackId);
  sendSuccess(res, feedback);
});

export const deleteFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { feedbackId } = feedbackIdParamSchema.parse(req.params);
  await feedbackService.deleteFeedbackById(feedbackId);
  sendSuccess(res, { id: feedbackId }, "Feedback deleted");
});
