import { QueryFilter, SortOrder } from "mongoose";
import { Score, ScoreDocument } from "../models/Score";
import { CsvColumn, toCsv } from "../utils/csv";
import { getDayRangeUtc, NAIROBI_UTC_OFFSET_MS } from "../utils/dateRange";
import { ListScoresQuery, ScoreFilters } from "../validators/report.validator";

export interface ScoreSummary {
  staffId: string;
  name: string;
  score: number;
  correctCount: number;
  totalPuzzles: number;
  durationMs: number;
  playedAt: string;
}

export interface ListScoresResult {
  items: ScoreSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface ReportSummary {
  totalPlayers: number;
  averageScore: number;
  topScore: number;
  // Distinct calendar days (Africa/Nairobi) that have at least one score,
  // with a per-day count - lets the frontend render real day filter chips
  // instead of hardcoding the event's Wed/Thu/Fri dates.
  playDays: { date: string; count: number }[];
}

const toScoreSummary = (doc: ScoreDocument): ScoreSummary => ({
  staffId: doc.staffId,
  name: doc.name,
  score: doc.score,
  correctCount: doc.correctCount,
  totalPuzzles: doc.totalPuzzles,
  durationMs: doc.durationMs,
  playedAt: doc.createdAt.toISOString(),
});

const buildFilterQuery = (filters: ScoreFilters): QueryFilter<ScoreDocument> => {
  const query: QueryFilter<ScoreDocument> = {};

  if (filters.date) {
    const { start, end } = getDayRangeUtc(filters.date);
    query.createdAt = { $gte: start, $lt: end };
  }

  if (filters.q) {
    const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");
    query.$or = [{ staffId: pattern }, { name: pattern }];
  }

  return query;
};

const buildSort = (filters: ScoreFilters): Record<string, SortOrder> => {
  const direction: SortOrder = filters.sortOrder === "asc" ? 1 : -1;
  const field = filters.sortBy === "date" ? "createdAt" : "score";
  return { [field]: direction };
};

export const listScores = async (query: ListScoresQuery): Promise<ListScoresResult> => {
  const filterQuery = buildFilterQuery(query);
  const sort = buildSort(query);
  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    Score.find(filterQuery).sort(sort).skip(skip).limit(query.limit),
    Score.countDocuments(filterQuery),
  ]);

  return { items: docs.map(toScoreSummary), total, page: query.page, limit: query.limit };
};

interface TotalsRow {
  _id: null;
  totalPlayers: number;
  averageScore: number;
  topScore: number;
}

interface DayGroupRow {
  _id: string;
  count: number;
}

export const getSummary = async (): Promise<ReportSummary> => {
  const [totalsResult, dayGroups] = await Promise.all([
    Score.aggregate<TotalsRow>([
      {
        $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          averageScore: { $avg: "$score" },
          topScore: { $max: "$score" },
        },
      },
    ]),
    Score.aggregate<DayGroupRow>([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $add: ["$createdAt", NAIROBI_UTC_OFFSET_MS] },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const totalsRow = totalsResult[0];

  return {
    totalPlayers: totalsRow?.totalPlayers ?? 0,
    averageScore: totalsRow ? Math.round(totalsRow.averageScore * 10) / 10 : 0,
    topScore: totalsRow?.topScore ?? 0,
    playDays: dayGroups.map((group) => ({ date: group._id, count: group.count })),
  };
};

const CSV_COLUMNS: CsvColumn<ScoreSummary>[] = [
  { header: "Staff ID", value: (row) => row.staffId },
  { header: "Name", value: (row) => row.name },
  { header: "Score", value: (row) => row.score },
  { header: "Correct", value: (row) => row.correctCount },
  { header: "Total Puzzles", value: (row) => row.totalPuzzles },
  { header: "Duration (s)", value: (row) => Math.round(row.durationMs / 1000) },
  { header: "Played At", value: (row) => row.playedAt },
];

export const exportScoresCsv = async (filters: ScoreFilters): Promise<string> => {
  const filterQuery = buildFilterQuery(filters);
  const sort = buildSort(filters);
  const docs = await Score.find(filterQuery).sort(sort);
  return toCsv(docs.map(toScoreSummary), CSV_COLUMNS);
};
