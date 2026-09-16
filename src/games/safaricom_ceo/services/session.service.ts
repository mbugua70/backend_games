import { QueryFilter, Types } from "mongoose";
import { logger } from "../../../core/logger/logger";
import { AppError } from "../../../core/utils/AppError";
import { Participant } from "../models/Participant";
import { Dimension, Question } from "../models/Question";
import { Profile } from "../models/Profile";
import { Session, SessionDocument, SessionStatus } from "../models/Session";
import { SessionResult, SessionResultDocument } from "../models/SessionResult";
import { getPublicOrganization } from "./organization.service";
import { getParticipantById } from "./participant.service";
import { getProfileResolver } from "./profileResolver.service";
import { DimensionScore, SCORING_VERSION, summarizeScores } from "./scoring.service";

export interface SessionResponsePayload {
  questionId: string;
  answerOptionId: string;
}

export interface SessionPayload {
  id: string;
  participantId: string;
  status: SessionStatus;
  answeredQuestionIds: string[];
  responses: SessionResponsePayload[];
  startedAt: Date;
  completedAt: Date | null;
}

// Never includes score/dimension - this is the shape handed back for
// session start/resume/response-submit, all participant-facing.
export const toSessionPayload = (session: SessionDocument): SessionPayload => ({
  id: session._id.toString(),
  participantId: session.participantId.toString(),
  status: session.status,
  answeredQuestionIds: session.responses.map((r) => r.questionId.toString()),
  responses: session.responses.map((r) => ({
    questionId: r.questionId.toString(),
    answerOptionId: r.answerOptionId.toString(),
  })),
  startedAt: session.startedAt,
  completedAt: session.completedAt,
});

export interface PublicProfilePayload {
  code: string;
  name: string;
  description: string;
}

export interface SessionResultPayload {
  sessionId: string;
  profile: PublicProfilePayload | null;
  strengths: unknown;
  nextFrontier: unknown;
  ceoQuestion: string | null;
}

const toResultPayload = async (result: SessionResultDocument): Promise<SessionResultPayload> => {
  let profile: PublicProfilePayload | null = null;
  if (result.profileId) {
    const profileDoc = await Profile.findById(result.profileId);
    if (profileDoc) {
      profile = { code: profileDoc.code, name: profileDoc.name, description: profileDoc.description };
    }
  }
  return {
    sessionId: result.sessionId.toString(),
    profile,
    strengths: result.strengths,
    nextFrontier: result.nextFrontier,
    ceoQuestion: result.ceoQuestion,
  };
};

export interface StartSessionResult {
  session: SessionPayload;
  wasCreated: boolean;
}

// idempotencyKey lets the frontend safely retry a dropped "start session"
// response without creating a second session for the same tap - unlike
// registration, this is NOT deduped by participantId alone, since a
// participant may legitimately have multiple sessions over time.
export const startSession = async (
  participantId: string,
  idempotencyKey?: string | null
): Promise<StartSessionResult> => {
  const organization = await getPublicOrganization();
  // Throws 404 if the participant doesn't exist or belongs to another org.
  await getParticipantById(participantId);

  if (idempotencyKey) {
    const existing = await Session.findOne({ organizationId: organization._id, idempotencyKey });
    if (existing) {
      return { session: toSessionPayload(existing), wasCreated: false };
    }
  }

  const session = await Session.create({
    organizationId: organization._id,
    participantId,
    status: "IN_PROGRESS",
    startedAt: new Date(),
    idempotencyKey: idempotencyKey ?? null,
  });

  return { session: toSessionPayload(session), wasCreated: true };
};

const findSessionOrThrow = async (sessionId: string): Promise<SessionDocument> => {
  const organization = await getPublicOrganization();
  const session = await Session.findOne({ _id: sessionId, organizationId: organization._id });
  if (!session) {
    throw new AppError("Session not found", 404);
  }
  return session;
};

export const getSessionForResume = async (sessionId: string): Promise<SessionPayload> => {
  const session = await findSessionOrThrow(sessionId);
  return toSessionPayload(session);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code?: unknown }).code === 11000;

// Bridges the rare window between a losing completeSession() call's atomic
// status-flip failing (because a concurrent request already won it) and
// that winner's SessionResult row actually landing - both sides of a
// double-tap should return the same finished result, not an error.
const RESULT_POLL_ATTEMPTS = 5;
const RESULT_POLL_DELAY_MS = 50;

const waitForResult = async (sessionId: string): Promise<SessionResultPayload> => {
  for (let attempt = 0; attempt < RESULT_POLL_ATTEMPTS; attempt += 1) {
    const existing = await SessionResult.findOne({ sessionId });
    if (existing) {
      return toResultPayload(existing);
    }
    await sleep(RESULT_POLL_DELAY_MS);
  }
  throw new AppError("Session completion is still being processed - please retry", 503);
};

// Idempotent and concurrency-safe without a Mongo transaction (this
// codebase has no existing transaction pattern - see GameSession.ts in
// ar_basketball for the same tradeoff): the findOneAndUpdate below is a
// single-document atomic operation, so of any number of simultaneous
// completeSession() calls for the same session, exactly one can ever
// observe {status: "IN_PROGRESS"} -> {status: "COMPLETED"} succeed. That
// caller alone computes and creates the SessionResult; SessionResult's
// unique index on sessionId is the backstop against a duplicate row if two
// processes somehow both believed they won. Every other caller (already
// completed, or lost the race) converges on the same result via
// toResultPayload/waitForResult.
export const completeSession = async (sessionId: string): Promise<SessionResultPayload> => {
  const organization = await getPublicOrganization();
  const session = await findSessionOrThrow(sessionId);

  if (session.status === "COMPLETED") {
    return getResult(sessionId);
  }
  if (session.status !== "IN_PROGRESS") {
    throw new AppError("Session is not in progress", 409);
  }

  const activeQuestions = await Question.find({
    organizationId: organization._id,
    isActive: true,
  });
  if (activeQuestions.length !== 5) {
    throw new AppError(
      "The game is not fully configured yet (expected exactly 5 active questions)",
      503
    );
  }

  const answeredQuestionIds = new Set(session.responses.map((r) => r.questionId.toString()));
  const missingCount = activeQuestions.filter(
    (q) => !answeredQuestionIds.has(q._id.toString())
  ).length;
  if (missingCount > 0) {
    throw new AppError(
      `${missingCount} of 5 required questions have not been answered yet`,
      422
    );
  }

  const claimed = await Session.findOneAndUpdate(
    { _id: sessionId, organizationId: organization._id, status: "IN_PROGRESS" },
    { $set: { status: "COMPLETED", completedAt: new Date() } },
    { new: true }
  );

  if (!claimed) {
    return waitForResult(sessionId);
  }

  const dimensionScores: DimensionScore[] = claimed.responses.map((r) => ({
    dimension: r.dimension,
    score: r.score,
  }));
  const summary = summarizeScores(dimensionScores);
  const resolution = await getProfileResolver().resolve({
    ...summary,
    organizationId: organization._id.toString(),
  });

  let profileId: Types.ObjectId | null = null;
  if (resolution.profileCode) {
    const profile = await Profile.findOne({
      organizationId: organization._id,
      code: resolution.profileCode,
      isActive: true,
    });
    profileId = profile ? profile._id : null;
  }

  let resultDoc: SessionResultDocument;
  try {
    resultDoc = await SessionResult.create({
      sessionId: claimed._id,
      organizationId: organization._id,
      dimensionScores: summary.dimensionScores.map((s) => ({
        dimension: s.dimension,
        score: s.score,
      })),
      totalScore: summary.total,
      averageScore: summary.average,
      strongestDimensions: summary.strongest,
      weakestDimensions: summary.weakest,
      profileId,
      strengths: resolution.strengths,
      nextFrontier: resolution.nextFrontier,
      ceoQuestion: resolution.ceoQuestion,
      scoringVersion: SCORING_VERSION,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return waitForResult(sessionId);
    }
    throw err;
  }

  logger.info(
    { sessionId, totalScore: summary.total, averageScore: summary.average },
    "Session completed"
  );

  return toResultPayload(resultDoc);
};

export const getResult = async (sessionId: string): Promise<SessionResultPayload> => {
  const session = await findSessionOrThrow(sessionId);
  if (session.status !== "COMPLETED") {
    throw new AppError("Session has not been completed yet", 409);
  }
  const result = await SessionResult.findOne({ sessionId: session._id });
  if (!result) {
    throw new AppError("Result not found for this session", 404);
  }
  return toResultPayload(result);
};

// ---- Admin (includes participant PII - never reused for a public route.
// "Aggregate analytics must not expose phone or email" only constrains
// services/analytics.service.ts, not this authenticated, single-record
// admin view, where an org's own admin needs contact details to follow up
// with a lead.) ----

export interface AdminParticipantSummary {
  id: string;
  businessName: string;
  phoneNumber: string;
  email: string;
  businessType: string;
  numberOfEmployees: string;
}

export interface AdminSessionListItemPayload {
  id: string;
  participant: AdminParticipantSummary | null;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  totalScore: number | null;
  averageScore: number | null;
  profileCode: string | null;
}

export interface AdminSessionResponsePayload {
  questionId: string;
  dimension: Dimension;
  answerOptionId: string;
  score: number;
  answeredAt: Date;
}

export interface AdminSessionResultPayload {
  totalScore: number;
  averageScore: number;
  strongestDimensions: Dimension[];
  weakestDimensions: Dimension[];
  scoringVersion: string;
  strengths: unknown;
  nextFrontier: unknown;
  ceoQuestion: string | null;
}

export interface AdminSessionDetailPayload extends AdminSessionListItemPayload {
  responses: AdminSessionResponsePayload[];
  result: AdminSessionResultPayload | null;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const toAdminParticipantSummary = (
  participant: {
    _id: Types.ObjectId;
    businessName: string;
    phoneNumber: string;
    email: string;
    businessType: string;
    numberOfEmployees: string;
  } | null
): AdminParticipantSummary | null =>
  participant
    ? {
        id: participant._id.toString(),
        businessName: participant.businessName,
        phoneNumber: participant.phoneNumber,
        email: participant.email,
        businessType: participant.businessType,
        numberOfEmployees: participant.numberOfEmployees,
      }
    : null;

export interface ListAdminSessionsOptions {
  page: number;
  limit: number;
  status?: SessionStatus;
}

export const listAdminSessions = async (
  organizationId: string,
  options: ListAdminSessionsOptions
): Promise<PaginatedResult<AdminSessionListItemPayload>> => {
  const filter: QueryFilter<SessionDocument> = { organizationId };
  if (options.status) {
    filter.status = options.status;
  }

  const skip = (options.page - 1) * options.limit;
  const [sessions, total] = await Promise.all([
    Session.find(filter).sort({ createdAt: -1 }).skip(skip).limit(options.limit),
    Session.countDocuments(filter),
  ]);

  const participants = await Participant.find({
    _id: { $in: sessions.map((s) => s.participantId) },
  });
  const participantById = new Map(participants.map((p) => [p._id.toString(), p]));

  const results = await SessionResult.find({ sessionId: { $in: sessions.map((s) => s._id) } });
  const resultBySessionId = new Map(results.map((r) => [r.sessionId.toString(), r]));

  const profileIds = results
    .map((r) => r.profileId)
    .filter((id): id is Types.ObjectId => id !== null);
  const profiles = await Profile.find({ _id: { $in: profileIds } });
  const profileCodeById = new Map(profiles.map((p) => [p._id.toString(), p.code]));

  const items = sessions.map((session) => {
    const result = resultBySessionId.get(session._id.toString());
    const profileCode =
      result?.profileId ? (profileCodeById.get(result.profileId.toString()) ?? null) : null;
    return {
      id: session._id.toString(),
      participant: toAdminParticipantSummary(
        participantById.get(session.participantId.toString()) ?? null
      ),
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      totalScore: result?.totalScore ?? null,
      averageScore: result?.averageScore ?? null,
      profileCode,
    };
  });

  return {
    items,
    page: options.page,
    limit: options.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / options.limit)),
  };
};

export const getAdminSessionById = async (
  organizationId: string,
  sessionId: string
): Promise<AdminSessionDetailPayload> => {
  const session = await Session.findOne({ _id: sessionId, organizationId });
  if (!session) {
    throw new AppError("Session not found", 404);
  }

  const participant = await Participant.findOne({
    _id: session.participantId,
    organizationId,
  });
  const result = await SessionResult.findOne({ sessionId: session._id });
  const profile = result?.profileId ? await Profile.findById(result.profileId) : null;

  return {
    id: session._id.toString(),
    participant: toAdminParticipantSummary(participant),
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    totalScore: result?.totalScore ?? null,
    averageScore: result?.averageScore ?? null,
    profileCode: profile?.code ?? null,
    responses: session.responses.map((r) => ({
      questionId: r.questionId.toString(),
      dimension: r.dimension,
      answerOptionId: r.answerOptionId.toString(),
      score: r.score,
      answeredAt: r.answeredAt,
    })),
    result: result
      ? {
          totalScore: result.totalScore,
          averageScore: result.averageScore,
          strongestDimensions: result.strongestDimensions,
          weakestDimensions: result.weakestDimensions,
          scoringVersion: result.scoringVersion,
          strengths: result.strengths,
          nextFrontier: result.nextFrontier,
          ceoQuestion: result.ceoQuestion,
        }
      : null,
  };
};
