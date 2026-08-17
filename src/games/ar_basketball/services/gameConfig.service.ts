import { AppError } from "../../../core/utils/AppError";
import { GameConfig, GameConfigDocument } from "../models/GameConfig";
import { assertEventOwnedByOrg } from "./eventAccess";
import { bumpConfigVersion } from "./event.service";

interface GameConfigInput {
  durationSeconds: number;
  normalBasketPoints: number;
  swishEnabled: boolean;
  swishPoints: number;
  longRangeEnabled: boolean;
  longRangeDistanceMeters: number;
  longRangePoints: number;
  streakEnabled: boolean;
  streakRequired: number;
  streakBonusPoints: number;
  leaderboardEnabled: boolean;
}

export interface GameConfigPayload extends GameConfigInput {
  id: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

const toGameConfigPayload = (config: GameConfigDocument): GameConfigPayload => ({
  id: config._id.toString(),
  eventId: config.eventId.toString(),
  durationSeconds: config.durationSeconds,
  normalBasketPoints: config.normalBasketPoints,
  swishEnabled: config.swishEnabled,
  swishPoints: config.swishPoints,
  longRangeEnabled: config.longRangeEnabled,
  longRangeDistanceMeters: config.longRangeDistanceMeters,
  longRangePoints: config.longRangePoints,
  streakEnabled: config.streakEnabled,
  streakRequired: config.streakRequired,
  streakBonusPoints: config.streakBonusPoints,
  leaderboardEnabled: config.leaderboardEnabled,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt,
});

export const createGameConfig = async (
  organizationId: string,
  eventId: string,
  input: GameConfigInput
): Promise<GameConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const existing = await GameConfig.findOne({ eventId });
  if (existing) {
    throw new AppError("This event already has a game config", 409);
  }

  const config = await GameConfig.create({ eventId, ...input });
  return toGameConfigPayload(config);
};

// Shared by the admin endpoint (org-scoped, below), the public config
// bundle endpoint, and gameSession.service when it snapshots config at
// session-start time.
export const getGameConfigByEventId = async (eventId: string): Promise<GameConfigPayload> => {
  const config = await GameConfig.findOne({ eventId });
  if (!config) {
    throw new AppError("Game config not found for this event", 404);
  }
  return toGameConfigPayload(config);
};

export const getGameConfigByEvent = async (
  organizationId: string,
  eventId: string
): Promise<GameConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  return getGameConfigByEventId(eventId);
};

export const updateGameConfig = async (
  organizationId: string,
  eventId: string,
  input: GameConfigInput
): Promise<GameConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const config = await GameConfig.findOneAndUpdate({ eventId }, input, { new: true });
  if (!config) {
    throw new AppError("Game config not found for this event", 404);
  }
  await bumpConfigVersion(eventId);
  return toGameConfigPayload(config);
};
