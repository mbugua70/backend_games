import { AppError } from "../../../core/utils/AppError";
import { Event } from "../models/Event";
import { Player, PlayerDocument } from "../models/Player";
import { RegistrationField } from "../models/RegistrationConfig";
import { assertEventOwnedByOrg } from "./eventAccess";
import { assertEventIsLive } from "./event.service";
import { getRegistrationConfigByEventId } from "./registrationConfig.service";

export interface PlayerPayload {
  id: string;
  eventId: string;
  registrationData: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const toPlayerPayload = (player: PlayerDocument): PlayerPayload => ({
  id: player._id.toString(),
  eventId: player.eventId.toString(),
  registrationData: player.registrationData,
  createdAt: player.createdAt,
  updatedAt: player.updatedAt,
});

// Checked against the event's admin-defined field list at registration
// time, so "fully admin-defined registration fields" is actually enforced,
// not just a shape the frontend happens to follow.
const assertValidRegistrationData = (
  fields: RegistrationField[],
  data: Record<string, string>
): void => {
  const knownKeys = new Set(fields.map((field) => field.key));
  for (const key of Object.keys(data)) {
    if (!knownKeys.has(key)) {
      throw new AppError(`Unknown registration field "${key}"`, 400);
    }
  }

  for (const field of fields) {
    const value = data[field.key];
    if (field.required && (value === undefined || value.trim() === "")) {
      throw new AppError(`"${field.label}" is required`, 400);
    }
    if (
      value !== undefined &&
      field.type === "select" &&
      field.options &&
      !field.options.includes(value)
    ) {
      throw new AppError(`"${field.label}" must be one of: ${field.options.join(", ")}`, 400);
    }
  }
};

// Public registration - the mobile client has no organizationId to scope
// by, so the event is looked up by its public code instead. Unlike
// jigsaw_puzzle's "guest" mode (which allows optional registration), the
// spec explicitly asks for this endpoint to reject use when the event
// doesn't require registration.
export const registerPlayer = async (
  eventCode: string,
  registrationData: Record<string, string>
): Promise<PlayerPayload> => {
  const event = await Event.findOne({ code: eventCode });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  assertEventIsLive(event);

  const registrationConfig = await getRegistrationConfigByEventId(event._id.toString());
  if (registrationConfig.playerMode === "guest") {
    throw new AppError("This event does not require player registration", 400);
  }

  assertValidRegistrationData(registrationConfig.fields, registrationData);

  const player = await Player.create({ eventId: event._id, registrationData });
  return toPlayerPayload(player);
};

export const listPlayersByEvent = async (
  organizationId: string,
  eventId: string
): Promise<PlayerPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const players = await Player.find({ eventId }).sort({ createdAt: -1 });
  return players.map(toPlayerPayload);
};

export const getPlayerById = async (
  organizationId: string,
  eventId: string,
  playerId: string
): Promise<PlayerPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const player = await Player.findOne({ _id: playerId, eventId });
  if (!player) {
    throw new AppError("Player not found", 404);
  }
  return toPlayerPayload(player);
};
