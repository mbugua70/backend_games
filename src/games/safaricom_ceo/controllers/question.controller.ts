import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as questionService from "../services/question.service";
import {
  createQuestionSchema,
  questionIdParamSchema,
  updateQuestionSchema,
} from "../validators/question.validator";

const orgOf = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const list = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const questions = await questionService.listAdminQuestions(orgOf(res));
  sendSuccess(res, questions);
});

export const getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { questionId } = questionIdParamSchema.parse(req.params);
  const question = await questionService.getAdminQuestionById(orgOf(res), questionId);
  sendSuccess(res, question);
});

export const create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = createQuestionSchema.parse(req.body);
  const question = await questionService.createQuestion(orgOf(res), input);
  sendSuccess(res, question, "Question created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { questionId } = questionIdParamSchema.parse(req.params);
  const input = updateQuestionSchema.parse(req.body);
  const question = await questionService.updateQuestion(orgOf(res), questionId, input);
  sendSuccess(res, question, "Question updated");
});

export const deactivate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { questionId } = questionIdParamSchema.parse(req.params);
  const question = await questionService.deactivateQuestion(orgOf(res), questionId);
  sendSuccess(res, question, "Question deactivated");
});
