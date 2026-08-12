import { Request, Response } from "express";
import * as gameService from "../services/game.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/response";
import {
  createSessionSchema,
  gameCodeParamSchema,
} from "../validators/game.validator";

export const createSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { puzzleIds } = createSessionSchema.parse(req.body);
    const state = await gameService.createGame(puzzleIds);

    sendSuccess(
      res,
      {
        gameCode: state.gameCode,
        displayUrl: `/play/${state.gameCode}`,
        facilitatorUrl: `/control/${state.gameCode}`,
      },
      "Game session created",
      201
    );
  }
);

export const getSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { gameCode } = gameCodeParamSchema.parse(req.params);
    const state = await gameService.getGame(gameCode);
    sendSuccess(res, state);
  }
);

export const deleteSession = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { gameCode } = gameCodeParamSchema.parse(req.params);
    await gameService.deleteGame(gameCode);
    sendSuccess(res, { gameCode }, "Game session deleted");
  }
);
