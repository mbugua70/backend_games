import { DifficultySnapshot, GameSession, GameSessionDocument } from "../models/GameSession";
import { assertEventOwnedByOrg } from "./eventAccess";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export interface LeaderboardEntry {
  sessionUuid: string;
  playerId: string | null;
  score: number;
  durationSeconds: number;
  difficulty: DifficultySnapshot;
  completedAt: Date;
}

const toLeaderboardEntry = (session: GameSessionDocument): LeaderboardEntry => ({
  sessionUuid: session.uuid,
  playerId: session.playerId ? session.playerId.toString() : null,
  // Non-null by construction: the query below only matches status:
  // "completed" sessions, and completion is what sets score/durationSeconds.
  score: session.score as number,
  durationSeconds: session.durationSeconds as number,
  difficulty: session.difficulty,
  completedAt: session.completedAt as Date,
});

// Shared by the admin reporting endpoint (this step) and the public
// leaderboard endpoint (step 9) - one query shape, so they can never drift
// on ranking rules.
export const getLeaderboard = async (eventId: string, limit?: number): Promise<LeaderboardEntry[]> => {
  const boundedLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const sessions = await GameSession.find({ eventId, status: "completed" })
    .sort({ score: -1, durationSeconds: 1 })
    .limit(boundedLimit);

  return sessions.map(toLeaderboardEntry);
};

export const getLeaderboardForAdmin = async (
  organizationId: string,
  eventId: string,
  limit?: number
): Promise<LeaderboardEntry[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  return getLeaderboard(eventId, limit);
};
