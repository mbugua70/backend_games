import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as playerService from "../services/player.service";
import { eventIdParamSchema, playerIdParamSchema } from "../validators/player.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const listPlayers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const players = await playerService.listPlayersByEvent(adminOf(res).organizationId, eventId);
  sendSuccess(res, players);
});

export const getPlayer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, playerId } = playerIdParamSchema.parse(req.params);
  const player = await playerService.getPlayerById(adminOf(res).organizationId, eventId, playerId);
  sendSuccess(res, player);
});
