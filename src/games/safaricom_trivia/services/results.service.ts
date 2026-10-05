import { PipelineStage, Types } from "mongoose";
import { Player } from "../models/Player";
import { Session } from "../models/Session";
import { LeaderboardQuery, ListPlayersQuery } from "../validators/results.validator";

// Admin-only - includes the full phone number, since that's how a winner
// gets contacted. Never reuse for a public route.
export interface PlayerResultPayload {
  playerId: string;
  name: string;
  phone: string;
  registeredAt: Date;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  sessionId: string | null;
  scorePercent: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  isLate: boolean | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface PaginatedPlayers {
  items: PlayerResultPayload[];
  page: number;
  limit: number;
  total: number;
}

interface PlayerWithSession {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  createdAt: Date;
  session: {
    _id: Types.ObjectId;
    status: "IN_PROGRESS" | "COMPLETED";
    scorePercent: number;
    correctCount: number;
    questionCount: number;
    isLate: boolean;
    startedAt: Date;
    completedAt: Date | null;
  } | null;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPlayerResult = (row: PlayerWithSession): PlayerResultPayload => {
  const s = row.session;
  const completed = s?.status === "COMPLETED";
  return {
    playerId: row._id.toString(),
    name: row.name,
    phone: row.phone,
    registeredAt: row.createdAt,
    status: s ? s.status : "NOT_STARTED",
    sessionId: s ? s._id.toString() : null,
    scorePercent: completed ? s.scorePercent : null,
    correctCount: completed ? s.correctCount : null,
    totalQuestions: s ? s.questionCount : null,
    isLate: completed ? s.isLate : null,
    startedAt: s ? s.startedAt : null,
    completedAt: completed ? s.completedAt : null,
    durationMs:
      completed && s.completedAt ? s.completedAt.getTime() - s.startedAt.getTime() : null,
  };
};

// Every registered player, newest first, with their game (if any) joined
// in - so admins can also see people who registered but never finished.
export const listPlayers = async (
  organizationId: string,
  query: ListPlayersQuery
): Promise<PaginatedPlayers> => {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    match.$or = [{ name: pattern }, { phone: pattern }];
  }

  const statusMatch: PipelineStage[] = [];
  if (query.status === "NOT_STARTED") {
    statusMatch.push({ $match: { session: null } });
  } else if (query.status) {
    statusMatch.push({ $match: { "session.status": query.status } });
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: Session.collection.name,
        localField: "_id",
        foreignField: "playerId",
        as: "sessions",
        pipeline: [
          {
            $project: {
              status: 1,
              scorePercent: 1,
              correctCount: 1,
              questionCount: { $size: "$questions" },
              isLate: 1,
              startedAt: 1,
              completedAt: 1,
            },
          },
        ],
      },
    },
    { $set: { session: { $ifNull: [{ $first: "$sessions" }, null] } } },
    { $project: { sessions: 0 } },
    ...statusMatch,
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [{ $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Player.aggregate<{
    items: PlayerWithSession[];
    total: { count: number }[];
  }>(pipeline);

  return {
    items: (result?.items ?? []).map(toPlayerResult),
    page: query.page,
    limit: query.limit,
    total: result?.total[0]?.count ?? 0,
  };
};

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  phone: string;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  durationMs: number;
  isLate: boolean;
  completedAt: Date;
}

// Highest score first; ties broken by whoever finished their game fastest.
export const getLeaderboard = async (
  organizationId: string,
  query: LeaderboardQuery
): Promise<LeaderboardEntry[]> => {
  const match: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
    status: "COMPLETED",
  };
  if (query.includeLate === "false") {
    match.isLate = false;
  }

  const rows = await Session.aggregate<{
    playerId: Types.ObjectId;
    scorePercent: number;
    correctCount: number;
    totalQuestions: number;
    durationMs: number;
    isLate: boolean;
    completedAt: Date;
    player: { name: string; phone: string } | null;
  }>([
    { $match: match },
    {
      $project: {
        playerId: 1,
        scorePercent: 1,
        correctCount: 1,
        isLate: 1,
        completedAt: 1,
        totalQuestions: { $size: "$questions" },
        durationMs: { $subtract: ["$completedAt", "$startedAt"] },
      },
    },
    { $sort: { scorePercent: -1, durationMs: 1, completedAt: 1 } },
    { $limit: query.limit },
    {
      $lookup: {
        from: Player.collection.name,
        localField: "playerId",
        foreignField: "_id",
        as: "player",
        pipeline: [{ $project: { name: 1, phone: 1 } }],
      },
    },
    { $set: { player: { $first: "$player" } } },
  ]);

  return rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.playerId.toString(),
    name: row.player?.name ?? "",
    phone: row.player?.phone ?? "",
    scorePercent: row.scorePercent,
    correctCount: row.correctCount,
    totalQuestions: row.totalQuestions,
    durationMs: row.durationMs,
    isLate: row.isLate,
    completedAt: row.completedAt,
  }));
};
