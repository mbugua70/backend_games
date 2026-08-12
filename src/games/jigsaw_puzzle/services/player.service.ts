import { AppError } from "../../../core/utils/AppError";
import { Event } from "../models/Event";
import { Player, PlayerDocument } from "../models/Player";

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

// Same isolation guarantee as event.service/gameConfig.service: confirm the
// event belongs to this admin's organization before any player data for it
// is read.
const assertEventOwnedByOrg = async (organizationId: string, eventId: string): Promise<void> => {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
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
