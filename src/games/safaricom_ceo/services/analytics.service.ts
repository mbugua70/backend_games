import { QueryFilter, Types } from "mongoose";
import { AppError } from "../../../core/utils/AppError";
import { Participant, ParticipantDocument } from "../models/Participant";
import { Dimension, DIMENSIONS } from "../models/Question";
import { Profile } from "../models/Profile";
import { Session, SessionDocument } from "../models/Session";
import { SessionResult } from "../models/SessionResult";
import { AnalyticsSummaryQuery } from "../validators/analytics.validator";

export interface AnalyticsSummary {
  totalParticipants: number;
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  incompleteSessions: number;
  completionRate: number;
  averageCompletionTimeSeconds: number | null;
  averageScoreByDimension: Record<Dimension, number | null>;
  responseDistributionByQuestion: Array<{
    questionId: string;
    optionCounts: Array<{ answerOptionId: string; count: number }>;
  }>;
  profileDistribution: Array<{ profileCode: string | null; count: number }>;
  businessTypeBreakdown: Array<{ businessType: string; count: number }>;
  employeeSizeBreakdown: Array<{ numberOfEmployees: string; count: number }>;
}

interface CountRow {
  _id: string;
  count: number;
}

const buildDateRange = (from?: Date, to?: Date): { $gte?: Date; $lte?: Date } | undefined => {
  if (!from && !to) {
    return undefined;
  }
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) {
    range.$gte = from;
  }
  if (to) {
    range.$lte = to;
  }
  return range;
};

// Computed by scanning the sessions already fetched for this query's scope
// (never a phone/email field - see the two DTOs above) rather than a Mongo
// aggregation pipeline: simple, auditable, and fast enough at the session
// volume a single live event produces. Revisit with a real pipeline only if
// that volume ever changes meaningfully.
export const getAnalyticsSummary = async (
  organizationId: string,
  query: AnalyticsSummaryQuery
): Promise<AnalyticsSummary> => {
  const orgObjectId = new Types.ObjectId(organizationId);
  const dateRange = buildDateRange(query.from, query.to);

  const participantFilter: QueryFilter<ParticipantDocument> = { organizationId: orgObjectId };
  if (dateRange) {
    participantFilter.createdAt = dateRange;
  }
  if (query.businessType) {
    participantFilter.businessType = query.businessType;
  }

  const sessionFilter: QueryFilter<SessionDocument> = { organizationId: orgObjectId };
  if (dateRange) {
    sessionFilter.createdAt = dateRange;
  }
  if (query.businessType) {
    const matchingParticipants = await Participant.find(participantFilter).select("_id");
    sessionFilter.participantId = { $in: matchingParticipants.map((p) => p._id) };
  }
  if (query.profile) {
    const profileCode = query.profile.toUpperCase();
    const profile = await Profile.findOne({ organizationId: orgObjectId, code: profileCode });
    if (!profile) {
      throw new AppError(`Profile code "${query.profile}" not found`, 404);
    }
    const matchingResults = await SessionResult.find({
      organizationId: orgObjectId,
      profileId: profile._id,
    }).select("sessionId");
    sessionFilter._id = { $in: matchingResults.map((r) => r.sessionId) };
  }

  const [totalParticipants, sessions, businessTypeAgg, employeeSizeAgg] = await Promise.all([
    Participant.countDocuments(participantFilter),
    Session.find(sessionFilter),
    Participant.aggregate<CountRow>([
      { $match: participantFilter },
      { $group: { _id: "$businessType", count: { $sum: 1 } } },
    ]),
    Participant.aggregate<CountRow>([
      { $match: participantFilter },
      { $group: { _id: "$numberOfEmployees", count: { $sum: 1 } } },
    ]),
  ]);

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED").length;
  const abandonedSessions = sessions.filter((s) => s.status === "ABANDONED").length;
  const incompleteSessions = sessions.filter((s) => s.status === "IN_PROGRESS").length;
  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 10000) / 10000 : 0;

  const completedWithDuration = sessions.filter(
    (s) => s.status === "COMPLETED" && s.completedAt !== null
  );
  const averageCompletionTimeSeconds =
    completedWithDuration.length > 0
      ? Math.round(
          completedWithDuration.reduce(
            (sum, s) => sum + (s.completedAt!.getTime() - s.startedAt.getTime()) / 1000,
            0
          ) / completedWithDuration.length
        )
      : null;

  const dimensionTotals = new Map<Dimension, { sum: number; count: number }>();
  const questionOptionCounts = new Map<string, Map<string, number>>();
  for (const session of sessions) {
    for (const response of session.responses) {
      const dimEntry = dimensionTotals.get(response.dimension) ?? { sum: 0, count: 0 };
      dimEntry.sum += response.score;
      dimEntry.count += 1;
      dimensionTotals.set(response.dimension, dimEntry);

      const questionId = response.questionId.toString();
      const optionCounts = questionOptionCounts.get(questionId) ?? new Map<string, number>();
      const optionId = response.answerOptionId.toString();
      optionCounts.set(optionId, (optionCounts.get(optionId) ?? 0) + 1);
      questionOptionCounts.set(questionId, optionCounts);
    }
  }

  const averageScoreByDimension = DIMENSIONS.reduce<Record<Dimension, number | null>>(
    (acc, dimension) => {
      const entry = dimensionTotals.get(dimension);
      acc[dimension] = entry ? Math.round((entry.sum / entry.count) * 100) / 100 : null;
      return acc;
    },
    {} as Record<Dimension, number | null>
  );

  const responseDistributionByQuestion = Array.from(questionOptionCounts.entries()).map(
    ([questionId, optionCounts]) => ({
      questionId,
      optionCounts: Array.from(optionCounts.entries()).map(([answerOptionId, count]) => ({
        answerOptionId,
        count,
      })),
    })
  );

  const results = await SessionResult.find({ sessionId: { $in: sessions.map((s) => s._id) } });
  const profileIds = results
    .map((r) => r.profileId)
    .filter((id): id is Types.ObjectId => id !== null);
  const profiles = await Profile.find({ _id: { $in: profileIds } });
  const profileCodeById = new Map(profiles.map((p) => [p._id.toString(), p.code]));
  const profileCounts = new Map<string | null, number>();
  for (const result of results) {
    const code = result.profileId ? (profileCodeById.get(result.profileId.toString()) ?? null) : null;
    profileCounts.set(code, (profileCounts.get(code) ?? 0) + 1);
  }
  const profileDistribution = Array.from(profileCounts.entries()).map(([profileCode, count]) => ({
    profileCode,
    count,
  }));

  return {
    totalParticipants,
    totalSessions,
    completedSessions,
    abandonedSessions,
    incompleteSessions,
    completionRate,
    averageCompletionTimeSeconds,
    averageScoreByDimension,
    responseDistributionByQuestion,
    profileDistribution,
    businessTypeBreakdown: businessTypeAgg.map((row) => ({
      businessType: row._id,
      count: row.count,
    })),
    employeeSizeBreakdown: employeeSizeAgg.map((row) => ({
      numberOfEmployees: row._id,
      count: row.count,
    })),
  };
};
