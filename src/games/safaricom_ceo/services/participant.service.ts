import { logger } from "../../../core/logger/logger";
import { AppError } from "../../../core/utils/AppError";
import { Participant, ParticipantDocument } from "../models/Participant";
import { RegisterParticipantInput } from "../validators/participant.validator";
import { getPublicOrganization } from "./organization.service";

export interface ParticipantPayload {
  id: string;
  phoneNumber: string;
  businessName: string;
  email: string;
  businessType: string;
  numberOfEmployees: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterParticipantResult {
  participant: ParticipantPayload;
  wasCreated: boolean;
}

// PII (phoneNumber, email) - the DTO below is the only shape this module
// ever hands to a controller/logger. Never log the raw input or a raw
// ParticipantDocument; every log call in this file passes only the id.
const toParticipantPayload = (participant: ParticipantDocument): ParticipantPayload => ({
  id: participant._id.toString(),
  phoneNumber: participant.phoneNumber,
  businessName: participant.businessName,
  email: participant.email,
  businessType: participant.businessType,
  numberOfEmployees: participant.numberOfEmployees,
  createdAt: participant.createdAt,
  updatedAt: participant.updatedAt,
});

// idempotencyKey lets the frontend safely retry a dropped registration
// response (unstable event wifi) without creating a duplicate participant -
// see Participant.ts's partial unique index on (organizationId,
// idempotencyKey).
export const registerParticipant = async (
  input: RegisterParticipantInput,
  idempotencyKey?: string | null
): Promise<RegisterParticipantResult> => {
  const organization = await getPublicOrganization();

  if (idempotencyKey) {
    const existing = await Participant.findOne({
      organizationId: organization._id,
      idempotencyKey,
    });
    if (existing) {
      return { participant: toParticipantPayload(existing), wasCreated: false };
    }
  }

  const participant = await Participant.create({
    organizationId: organization._id,
    phoneNumber: input.phoneNumber,
    businessName: input.businessName,
    email: input.email,
    businessType: input.businessType,
    numberOfEmployees: input.numberOfEmployees,
    idempotencyKey: idempotencyKey ?? null,
  });

  logger.info({ participantId: participant._id.toString() }, "Participant registered");

  return { participant: toParticipantPayload(participant), wasCreated: true };
};

export const getParticipantById = async (participantId: string): Promise<ParticipantPayload> => {
  const organization = await getPublicOrganization();
  const participant = await Participant.findOne({
    _id: participantId,
    organizationId: organization._id,
  });
  if (!participant) {
    throw new AppError("Participant not found", 404);
  }
  return toParticipantPayload(participant);
};
