import { Request, Response } from "express";
import * as tugwarService from "../services/tugwar.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/response";
import { finishMatchSchema, sessionIdParamSchema, startMatchSchema } from "../validators/tugwar.validator";

export const start = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = startMatchSchema.parse(req.body);
    const result = await tugwarService.startMatch(input);
    sendSuccess(res, result, "Match started", 201);
  }
);

export const finish = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = sessionIdParamSchema.parse(req.params);
    const input = finishMatchSchema.parse(req.body);
    const result = await tugwarService.finishMatch(sessionId, input);
    sendSuccess(res, result, "Match finished");
  }
);
