import { AppError } from "../../../core/utils/AppError";
import { Event } from "../models/Event";
import { GameConfig, RegistrationField } from "../models/GameConfig";
import { Player, PlayerDocument } from "../models/Player";
import { assertEventOwnedByOrg } from "./eventAccess";

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

// Checked against the event's admin-defined field list at registration time,
// so "Fully admin-defined registration fields" is actually enforced and not
// just a shape the frontend happens to follow.
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
    if (value !== undefined && field.type === "select" && field.options && !field.options.includes(value)) {
      throw new AppError(`"${field.label}" must be one of: ${field.options.join(", ")}`, 400);
    }
  }
};

// Public registration - the game client has no organizationId to scope by,
// so the event is looked up by its public code instead.
export const registerPlayer = async (
  eventCode: string,
  registrationData: Record<string, string>
): Promise<PlayerPayload> => {
  const event = await Event.findOne({ code: eventCode });
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const config = await GameConfig.findOne({ eventId: event._id });
  if (!config) {
    throw new AppError("Game config not found for this event", 404);
  }

  assertValidRegistrationData(config.registrationFields, registrationData);

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
