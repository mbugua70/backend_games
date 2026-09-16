import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as questionService from "../services/question.service";

export const listPublic = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const questions = await questionService.listPublicQuestions();
  sendSuccess(res, questions);
});
