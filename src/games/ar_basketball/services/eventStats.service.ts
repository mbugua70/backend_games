import { Types } from "mongoose";
import { GameSession } from "../models/GameSession";
import { Player } from "../models/Player";
import { assertEventOwnedByOrg } from "./eventAccess";
import { getLeaderboard, LeaderboardEntry } from "./leaderboard.service";

export interface EventStats {
  totalRegisteredPlayers: number;
  totalSessions: number;
  uniquePlayers: number;
  totalShots: number;
  totalBaskets: number;
  totalMisses: number;
  totalSwishes: number;
  totalLongRangeBaskets: number;
  // Null until at least one session has completed - an average/max over
  // zero completed sessions isn't a meaningful 0.
  averageScore: number | null;
  highestScore: number | null;
  averageShotsPerSession: number | null;
  averageShootingAccuracy: number | null;
  averageSwishesPerGame: number | null;
  averageLongRangeSuccessRate: number | null;
  bestStreak: number | null;
  sessionsPerHour: Array<{ hour: string; count: number }>;
  leaderboard: LeaderboardEntry[];
}

interface CompletedAggregate {
  totalSessions: number;
  uniquePlayers: number;
  totalShots: number;
  totalBaskets: number;
  totalMisses: number;
  totalSwishes: number;
  totalLongRangeBaskets: number;
  totalLongRangeAttempts: number;
  averageScore: number;
  highestScore: number;
  averageShotsPerSession: number;
  averageAccuracy: number;
  averageSwishesPerGame: number;
  bestStreak: number;
}

interface SessionsPerHourRow {
  hour: Date;
  count: number;
}

// No separate analytics/stats collection - always computed live from
// Player/GameSession, so it can never drift out of sync with the source
// data. GameSession's denormalized per-session totals (see models/
// GameSession.ts) keep this a single $group pass, no $unwind on the
// embedded shots array needed.
export const getEventStats = async (
  organizationId: string,
  eventId: string
): Promise<EventStats> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const eventObjectId = new Types.ObjectId(eventId);

  const [totalRegisteredPlayers, completedAgg, sessionsPerHourRows, leaderboard] =
    await Promise.all([
      Player.countDocuments({ eventId: eventObjectId }),
      GameSession.aggregate<CompletedAggregate>([
        { $match: { eventId: eventObjectId, status: "completed" } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            uniquePlayers: { $addToSet: "$playerId" },
            totalShots: { $sum: "$totalShots" },
            totalBaskets: { $sum: "$totalBaskets" },
            totalMisses: { $sum: "$totalMisses" },
            totalSwishes: { $sum: "$totalSwishes" },
            totalLongRangeBaskets: { $sum: "$totalLongRangeBaskets" },
            totalLongRangeAttempts: { $sum: "$totalLongRangeAttempts" },
            averageScore: { $avg: "$score" },
            highestScore: { $max: "$score" },
            averageShotsPerSession: { $avg: "$totalShots" },
            averageAccuracy: { $avg: "$accuracy" },
            averageSwishesPerGame: { $avg: "$totalSwishes" },
            bestStreak: { $max: "$bestStreak" },
          },
        },
        {
          $project: {
            totalSessions: 1,
            uniquePlayers: {
              $size: { $filter: { input: "$uniquePlayers", cond: { $ne: ["$$this", null] } } },
            },
            totalShots: 1,
            totalBaskets: 1,
            totalMisses: 1,
            totalSwishes: 1,
            totalLongRangeBaskets: 1,
            totalLongRangeAttempts: 1,
            averageScore: 1,
            highestScore: 1,
            averageShotsPerSession: 1,
            averageAccuracy: 1,
            averageSwishesPerGame: 1,
            bestStreak: 1,
          },
        },
      ]),
      GameSession.aggregate<SessionsPerHourRow>([
        { $match: { eventId: eventObjectId, status: "completed" } },
        {
          $group: {
            _id: { $dateTrunc: { date: "$completedAt", unit: "hour" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, hour: "$_id", count: 1 } },
      ]),
      getLeaderboard(eventId),
    ]);

  const completed = completedAgg[0];

  return {
    totalRegisteredPlayers,
    totalSessions: completed?.totalSessions ?? 0,
    uniquePlayers: completed?.uniquePlayers ?? 0,
    totalShots: completed?.totalShots ?? 0,
    totalBaskets: completed?.totalBaskets ?? 0,
    totalMisses: completed?.totalMisses ?? 0,
    totalSwishes: completed?.totalSwishes ?? 0,
    totalLongRangeBaskets: completed?.totalLongRangeBaskets ?? 0,
    averageScore: completed ? Math.round(completed.averageScore) : null,
    highestScore: completed ? completed.highestScore : null,
    averageShotsPerSession: completed
      ? Math.round(completed.averageShotsPerSession * 100) / 100
      : null,
    averageShootingAccuracy: completed
      ? Math.round(completed.averageAccuracy * 10000) / 10000
      : null,
    averageSwishesPerGame: completed
      ? Math.round(completed.averageSwishesPerGame * 100) / 100
      : null,
    averageLongRangeSuccessRate:
      completed && completed.totalLongRangeAttempts > 0
        ? Math.round((completed.totalLongRangeBaskets / completed.totalLongRangeAttempts) * 10000) /
          10000
        : null,
    bestStreak: completed ? completed.bestStreak : null,
    sessionsPerHour: sessionsPerHourRows.map((row) => ({
      hour: row.hour.toISOString(),
      count: row.count,
    })),
    leaderboard,
  };
};
