import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as responseService from "../services/response.service";
import { sessionQuestionParamSchema, submitResponseSchema } from "../validators/response.validator";

export const upsert = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sessionId, questionId } = sessionQuestionParamSchema.parse(req.params);
  const { answerOptionId } = submitResponseSchema.parse(req.body);
  const session = await responseService.upsertResponse(sessionId, questionId, answerOptionId);
  sendSuccess(res, session, "Answer recorded");
});
