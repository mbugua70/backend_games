import { AppError } from "../../../core/utils/AppError";
import {
  LeaderboardConfig,
  LeaderboardConfigDocument,
  RankingStrategy,
} from "../models/LeaderboardConfig";
import { assertEventOwnedByOrg } from "./eventAccess";
import { bumpConfigVersion } from "./event.service";

interface LeaderboardConfigInput {
  rankingStrategy: RankingStrategy;
  displayLimit: number;
}

export interface LeaderboardConfigPayload {
  id: string;
  eventId: string;
  rankingStrategy: RankingStrategy;
  displayLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const toLeaderboardConfigPayload = (
  config: LeaderboardConfigDocument
): LeaderboardConfigPayload => ({
  id: config._id.toString(),
  eventId: config.eventId.toString(),
  rankingStrategy: config.rankingStrategy,
  displayLimit: config.displayLimit,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt,
});

export const createLeaderboardConfig = async (
  organizationId: string,
  eventId: string,
  input: LeaderboardConfigInput
): Promise<LeaderboardConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const existing = await LeaderboardConfig.findOne({ eventId });
  if (existing) {
    throw new AppError("This event already has a leaderboard config", 409);
  }

  const config = await LeaderboardConfig.create({ eventId, ...input });
  return toLeaderboardConfigPayload(config);
};

// Shared by the admin endpoint (org-scoped, below), the public config
// bundle endpoint, and leaderboard.service when it picks a sort strategy.
export const getLeaderboardConfigByEventId = async (
  eventId: string
): Promise<LeaderboardConfigPayload> => {
  const config = await LeaderboardConfig.findOne({ eventId });
  if (!config) {
    throw new AppError("Leaderboard config not found for this event", 404);
  }
  return toLeaderboardConfigPayload(config);
};

export const getLeaderboardConfigByEvent = async (
  organizationId: string,
  eventId: string
): Promise<LeaderboardConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  return getLeaderboardConfigByEventId(eventId);
};

export const updateLeaderboardConfig = async (
  organizationId: string,
  eventId: string,
  input: LeaderboardConfigInput
): Promise<LeaderboardConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const config = await LeaderboardConfig.findOneAndUpdate({ eventId }, input, { new: true });
  if (!config) {
    throw new AppError("Leaderboard config not found for this event", 404);
  }
  await bumpConfigVersion(eventId);
  return toLeaderboardConfigPayload(config);
};
