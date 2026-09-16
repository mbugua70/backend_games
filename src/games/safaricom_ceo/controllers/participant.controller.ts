import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as participantService from "../services/participant.service";
import { registerParticipantSchema } from "../validators/participant.validator";

const getIdempotencyKey = (req: Request): string | null => {
  const header = req.headers["idempotency-key"];
  return typeof header === "string" && header.trim().length > 0 ? header.trim() : null;
};

export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = registerParticipantSchema.parse(req.body);
  const { participant, wasCreated } = await participantService.registerParticipant(
    input,
    getIdempotencyKey(req)
  );
  sendSuccess(
    res,
    participant,
    wasCreated ? "Participant registered" : "Participant already registered",
    wasCreated ? 201 : 200
  );
});
