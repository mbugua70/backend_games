import { AppError } from "../../../core/utils/AppError";
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
