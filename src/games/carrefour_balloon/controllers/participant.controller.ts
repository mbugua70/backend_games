import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as participantService from "../services/participant.service";
import { eventIdParamSchema } from "../validators/common.validator";
import { registerParticipantSchema } from "../validators/participant.validator";

const getIdempotencyKey = (req: Request): string | null => {
  const header = req.headers["idempotency-key"];
  return typeof header === "string" && header.trim().length > 0 ? header.trim() : null;
};

export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = registerParticipantSchema.parse(req.body);
  const result = await participantService.registerParticipant(
    eventId,
    { fields: input.fields, consentAccepted: input.consentAccepted },
    getIdempotencyKey(req)
  );
  sendSuccess(res, result, result.wasCreated ? "Participant registered" : "Already registered", result.wasCreated ? 201 : 200);
});
