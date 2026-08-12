import { Request, Response } from "express";
import * as scoreService from "../services/score.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/response";
import { submitScoreSchema } from "../validators/score.validator";

export const submit = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = submitScoreSchema.parse(req.body);
    const result = await scoreService.submitScore(input);
    sendSuccess(res, result, "Score submitted", 201);
  }
);
