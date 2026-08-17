import { GameSession, GameSessionDocument } from "../models/GameSession";
import { assertEventOwnedByOrg } from "./eventAccess";
import { getLeaderboardConfigByEventId } from "./leaderboardConfig.service";

const MAX_LIMIT = 100;

export interface LeaderboardEntry {
  rank: number;
  sessionUuid: string;
  playerId: string | null;
  playerName: string | null;
  maskedPhone: string | null;
  score: number;
  shotsMade: number;
  bestStreak: number;
  durationSeconds: number;
  accuracy: number;
  completedAt: Date;
}

// Each strategy adds a different tie-break after score DESC, matching one
// of the three compound indexes on GameSession.
const SORTS: Record<string, Record<string, 1 | -1>> = {
  highest_score: { score: -1 },
  highest_score_then_fastest: { score: -1, durationSeconds: 1 },
  highest_score_then_best_accuracy: { score: -1, accuracy: -1 },
};

const toLeaderboardEntry = (session: GameSessionDocument, rank: number): LeaderboardEntry => ({
  rank,
  sessionUuid: session.sessionUuid,
  playerId: session.playerId ? session.playerId.toString() : null,
  playerName: session.playerSnapshot?.displayName ?? null,
  maskedPhone: session.playerSnapshot?.maskedPhone ?? null,
  // Non-null by construction: the query below only matches status:
  // "completed" sessions, and completion is what sets these fields.
  score: session.score as number,
  shotsMade: session.totalBaskets,
  bestStreak: session.bestStreak,
  durationSeconds: session.durationSeconds as number,
  accuracy: session.accuracy as number,
  completedAt: session.completedAt as Date,
});

// Shared by the admin reporting endpoint and the public leaderboard
// endpoint - one query shape, so they can never drift on ranking rules.
export const getLeaderboard = async (
  eventId: string,
  limit?: number
): Promise<LeaderboardEntry[]> => {
  const config = await getLeaderboardConfigByEventId(eventId);
  const boundedLimit = Math.min(limit ?? config.displayLimit, MAX_LIMIT);
  const sort = SORTS[config.rankingStrategy] ?? SORTS.highest_score;

  const sessions = await GameSession.find({ eventId, status: "completed" })
    .sort(sort)
    .limit(boundedLimit);

  return sessions.map((session, index) => toLeaderboardEntry(session, index + 1));
};

export const getLeaderboardForAdmin = async (
  organizationId: string,
  eventId: string,
  limit?: number
): Promise<LeaderboardEntry[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  return getLeaderboard(eventId, limit);
};
