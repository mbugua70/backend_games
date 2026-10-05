import { z } from "zod";

export const PLAYER_STATUS_FILTERS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type PlayerStatusFilter = (typeof PLAYER_STATUS_FILTERS)[number];

export const listPlayersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  // Matches name or phone, case-insensitive substring.
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(PLAYER_STATUS_FILTERS).optional(),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  // Late submissions (see Session.isLate) are left off the leaderboard by
  // default, since their timing can't be trusted.
  includeLate: z.enum(["true", "false"]).default("false"),
});

export type ListPlayersQuery = z.infer<typeof listPlayersQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
