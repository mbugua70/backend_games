import { Types } from "mongoose";
import { GameSession } from "../models/GameSession";
import { Player } from "../models/Player";
import { assertEventOwnedByOrg } from "./eventAccess";

export interface EventStats {
  totalPlayers: number;
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  // Percentage (0-100, 2dp), 0 when there are no sessions yet.
  completionRate: number;
  // All three are null until at least one session has completed - an
  // average/max over zero completed sessions isn't a meaningful 0.
  averageScore: number | null;
  averageDurationSeconds: number | null;
  highScore: number | null;
}

interface StatusCount {
  _id: string;
  count: number;
}

interface CompletedAggregate {
  averageScore: number;
  averageDurationSeconds: number;
  highScore: number;
}

// No separate analytics/stats collection - always computed live from
// Player/GameSession, so it can never drift out of sync with the source data.
export const getEventStats = async (
  organizationId: string,
  eventId: string
): Promise<EventStats> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const eventObjectId = new Types.ObjectId(eventId);

  const [totalPlayers, statusCounts, completedAgg] = await Promise.all([
    Player.countDocuments({ eventId: eventObjectId }),
    GameSession.aggregate<StatusCount>([
      { $match: { eventId: eventObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    GameSession.aggregate<CompletedAggregate>([
      { $match: { eventId: eventObjectId, status: "completed" } },
      {
        $group: {
          _id: null,
          averageScore: { $avg: "$score" },
          averageDurationSeconds: { $avg: "$durationSeconds" },
          highScore: { $max: "$score" },
        },
      },
    ]),
  ]);

  const completedSessions =
    statusCounts.find((entry) => entry._id === "completed")?.count ?? 0;
  const inProgressSessions =
    statusCounts.find((entry) => entry._id === "in_progress")?.count ?? 0;
  const totalSessions = completedSessions + inProgressSessions;

  const completed = completedAgg[0];

  return {
    totalPlayers,
    totalSessions,
    completedSessions,
    inProgressSessions,
    completionRate:
      totalSessions === 0
        ? 0
        : Math.round((completedSessions / totalSessions) * 10000) / 100,
    averageScore: completed ? Math.round(completed.averageScore) : null,
    averageDurationSeconds: completed
      ? Math.round(completed.averageDurationSeconds)
      : null,
    highScore: completed ? completed.highScore : null,
  };
};
