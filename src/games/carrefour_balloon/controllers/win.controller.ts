import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as participantService from "../services/participant.service";
import * as winService from "../services/win.service";
import { eventIdParamSchema } from "../validators/common.validator";
import { recordWinSchema } from "../validators/win.validator";

export const record = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = recordWinSchema.parse(req.body);

  // Throws on a present-but-invalid token; returns null only when no
  // Authorization header was sent at all (win.service.ts then decides
  // whether that's acceptable based on the event's registrationEnabled
  // flag).
  const participantId = participantService.resolveParticipantFromHeader(req.headers.authorization);

  const result = await winService.recordWin({
    eventId,
    brandId: input.brandId,
    giftPoolId: input.giftPoolId,
    giftId: input.giftId,
    roundId: input.roundId,
    balloonId: input.balloonId,
    configVersion: input.configVersion,
    idempotencyKey: input.idempotencyKey,
    participantId,
    anonymousIdentity: input.anonymousIdentity ?? null,
  });

  sendSuccess(res, result, "Win recorded", 201);
});
