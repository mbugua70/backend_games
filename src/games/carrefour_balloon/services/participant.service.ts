import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";
import { logger } from "../../../core/logger/logger";
import { signToken, verifyToken } from "../../../core/utils/authToken";
import { Event } from "../models/Event";
import { Participant, ParticipantDocument } from "../models/Participant";
import { RegistrationConfig } from "../models/RegistrationConfig";

export interface RegisterParticipantInput {
  fields: Record<string, string>;
  consentAccepted: boolean;
}

export interface ParticipantTokenPayload {
  participantId: string;
  eventId: string;
  type: "participant";
}

export interface RegisterParticipantResult {
  participantId: string;
  participantToken: string;
  wasCreated: boolean;
}

const toParticipantToken = (participant: ParticipantDocument): string =>
  signToken(
    {
      participantId: participant._id.toString(),
      eventId: participant.eventId.toString(),
      type: "participant",
    } satisfies ParticipantTokenPayload,
    env.JWT_SECRET,
    env.CARREFOUR_BALLOON_PARTICIPANT_TOKEN_EXPIRES_IN
  );

// idempotencyKey lets the frontend safely retry a dropped registration
// response without creating a duplicate participant - see Participant.ts's
// partial unique index on (eventId, idempotencyKey).
export const registerParticipant = async (
  eventId: string,
  input: RegisterParticipantInput,
  idempotencyKey: string | null
): Promise<RegisterParticipantResult> => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  if (!event.registrationEnabled) {
    throw new AppError("Registration is not enabled for this event", 400);
  }

  if (idempotencyKey) {
    const existing = await Participant.findOne({ eventId: event._id, idempotencyKey });
    if (existing) {
      return {
        participantId: existing._id.toString(),
        participantToken: toParticipantToken(existing),
        wasCreated: false,
      };
    }
  }

  const registrationConfig = await RegistrationConfig.findOne({ eventId: event._id });
  const fieldDefs = registrationConfig?.fields ?? [];

  for (const def of fieldDefs) {
    const value = input.fields[def.key];
    if (def.required && (!value || value.trim().length === 0)) {
      throw new AppError(`"${def.label}" is required`, 400);
    }
    if (def.type === "select" && value && def.options && !def.options.includes(value)) {
      throw new AppError(`"${def.label}" must be one of the configured options`, 400);
    }
  }

  const participant = await Participant.create({
    eventId: event._id,
    registrationData: input.fields,
    consentAcceptedAt: input.consentAccepted ? new Date() : null,
    idempotencyKey: idempotencyKey ?? null,
  });

  logger.info({ participantId: participant._id.toString() }, "carrefour_balloon participant registered");

  return {
    participantId: participant._id.toString(),
    participantToken: toParticipantToken(participant),
    wasCreated: true,
  };
};

// Returns the participant id when the Authorization header carries a valid
// participant token, null when there's no header at all, and throws when a
// header is present but invalid/expired - distinguishing "not provided"
// from "provided but bad" so callers can decide whether that's acceptable
// (registration disabled) or fatal (registration enabled).
export const resolveParticipantFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw new AppError("Malformed Authorization header", 401);
  }
  try {
    const payload = verifyToken<ParticipantTokenPayload>(token, env.JWT_SECRET);
    if (payload.type !== "participant") {
      throw new AppError("Invalid participant token", 401);
    }
    return payload.participantId;
  } catch {
    throw new AppError("Invalid or expired participant token", 401);
  }
};
