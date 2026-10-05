import { Types } from "mongoose";
import { logger } from "../../../core/logger/logger";
import { AppError } from "../../../core/utils/AppError";
import { Player } from "../models/Player";
import { Question, QuestionDocument } from "../models/Question";
import { Session, SessionDocument, SessionQuestion, SessionStatus } from "../models/Session";
import { SubmitSessionInput } from "../validators/session.validator";
import { GameConfigPayload, getOrCreateGameConfig, toGameConfigPayload } from "./gameConfig.service";
import { getPublicOrganization } from "./organization.service";
import { ALREADY_PLAYED_MESSAGE } from "./player.service";
import { ScoredAnswer, scoreAnswers } from "./scoring.service";

// How long after startedAt + totalTimeLimitMs a submit still counts as on
// time. Covers the last question's reveal animation and a slow network,
// so only a game that genuinely ran long gets flagged.
export const LATE_SUBMIT_GRACE_MS = 30_000;

// Includes the correct answer on purpose: the frontend reveals right/wrong
// locally the instant a player taps, with no request per answer (unreliable
// event wifi). The score is still decided server-side at submit - see
// submitSession.
export interface PlayQuestionPayload {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
}

export interface PlaySessionPayload {
  session: {
    id: string;
    status: SessionStatus;
    startedAt: Date;
    totalTimeLimitMs: number;
  };
  // Lets the client work out how much of totalTimeLimitMs is left on a
  // resume without trusting its own clock.
  serverTime: Date;
  config: GameConfigPayload;
  questions: PlayQuestionPayload[];
}

export interface SessionResultPayload {
  sessionId: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  scorePercent: number;
  isLate: boolean;
  completedAt: Date | null;
  answers: ScoredAnswer[];
}

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

const toSessionQuestion = (question: QuestionDocument): SessionQuestion => ({
  questionId: question._id,
  text: question.text,
  options: question.options.map((option) => ({ optionId: option._id, text: option.text })),
  correctOptionId: question.correctOptionId,
});

const toPlayPayload = (session: SessionDocument, config: GameConfigPayload): PlaySessionPayload => ({
  session: {
    id: session._id.toString(),
    status: session.status,
    startedAt: session.startedAt,
    totalTimeLimitMs: session.totalTimeLimitMs,
  },
  serverTime: new Date(),
  config,
  questions: session.questions.map((q) => ({
    id: q.questionId.toString(),
    text: q.text,
    options: q.options.map((o) => ({ id: o.optionId.toString(), text: o.text })),
    correctOptionId: q.correctOptionId.toString(),
  })),
});

const toResultPayload = (session: SessionDocument): SessionResultPayload => {
  const answersByQuestion = new Map(session.answers.map((a) => [a.questionId.toString(), a]));
  return {
    sessionId: session._id.toString(),
    totalQuestions: session.questions.length,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    skippedCount: session.skippedCount,
    scorePercent: session.scorePercent,
    isLate: session.isLate,
    completedAt: session.completedAt,
    answers: session.questions.map((q) => {
      const answer = answersByQuestion.get(q.questionId.toString());
      return {
        questionId: q.questionId.toString(),
        selectedOptionId: answer?.selectedOptionId?.toString() ?? null,
        correctOptionId: q.correctOptionId.toString(),
        isCorrect: answer?.isCorrect ?? false,
      };
    }),
  };
};

// Starts the player's one game, or resumes it if it's already in progress
// (page refresh, crashed browser). A player only ever has one session
// (unique index on playerId), so "start" is naturally idempotent: two
// simultaneous taps converge on the same session and the same questions.
export const startOrResumeSession = async (playerId: string): Promise<PlaySessionPayload> => {
  const organization = await getPublicOrganization();
  const player = await Player.findOne({ _id: playerId, organizationId: organization._id });
  if (!player) {
    throw new AppError("Player not found", 404);
  }

  const config = toGameConfigPayload(await getOrCreateGameConfig(organization._id));

  const existing = await Session.findOne({ playerId: player._id });
  if (existing) {
    if (existing.status === "COMPLETED") {
      throw new AppError(ALREADY_PLAYED_MESSAGE, 409);
    }
    return toPlayPayload(existing, config);
  }

  const sampled = await Question.aggregate<{ _id: Types.ObjectId }>([
    { $match: { organizationId: organization._id, isActive: true } },
    { $sample: { size: config.questionsPerGame } },
    { $project: { _id: 1 } },
  ]);
  if (sampled.length === 0) {
    throw new AppError("No questions are available yet - please try again later", 503);
  }
  if (sampled.length < config.questionsPerGame) {
    // Plays with what's there rather than refusing - same as the original
    // backend's $sample - but worth knowing about before an event.
    logger.warn(
      { available: sampled.length, wanted: config.questionsPerGame },
      "safaricom_trivia has fewer active questions than questionsPerGame"
    );
  }

  // $sample's order is random; re-fetch full documents and put them back
  // in that order.
  const ids = sampled.map((q) => q._id);
  const docs = await Question.find({ _id: { $in: ids } });
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  const questions: SessionQuestion[] = [];
  for (const id of ids) {
    const doc = byId.get(id.toString());
    if (doc) {
      questions.push(toSessionQuestion(doc));
    }
  }

  try {
    const session = await Session.create({
      organizationId: organization._id,
      playerId: player._id,
      status: "IN_PROGRESS",
      questions,
      totalTimeLimitMs: config.totalTimeLimitMs,
      startedAt: new Date(),
    });
    logger.info({ sessionId: session._id.toString() }, "safaricom_trivia session started");
    return toPlayPayload(session, config);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const winner = await Session.findOne({ playerId: player._id });
      if (winner) {
        return toPlayPayload(winner, config);
      }
    }
    throw err;
  }
};

const findOwnSessionOrThrow = async (
  playerId: string,
  sessionId: string
): Promise<SessionDocument> => {
  // Filtering by playerId as well means another player's session id is
  // indistinguishable from a non-existent one.
  const session = await Session.findOne({ _id: sessionId, playerId });
  if (!session) {
    throw new AppError("Session not found", 404);
  }
  return session;
};

// Scores the submitted answers against the session's own snapshot and
// completes the session. Exactly-once without a transaction: the
// findOneAndUpdate is conditional on status IN_PROGRESS, so of any number
// of concurrent submits only one can complete it. Every other submit -
// including a retry after a dropped response - gets the stored result
// back unchanged, never a re-score with different answers.
export const submitSession = async (
  playerId: string,
  sessionId: string,
  input: SubmitSessionInput
): Promise<SessionResultPayload> => {
  const session = await findOwnSessionOrThrow(playerId, sessionId);
  if (session.status === "COMPLETED") {
    return toResultPayload(session);
  }

  const summary = scoreAnswers(
    session.questions.map((q) => ({
      questionId: q.questionId.toString(),
      optionIds: q.options.map((o) => o.optionId.toString()),
      correctOptionId: q.correctOptionId.toString(),
    })),
    input.answers
  );

  const completedAt = new Date();
  const deadline = session.startedAt.getTime() + session.totalTimeLimitMs + LATE_SUBMIT_GRACE_MS;

  const completed = await Session.findOneAndUpdate(
    { _id: session._id, status: "IN_PROGRESS" },
    {
      $set: {
        status: "COMPLETED",
        answers: summary.answers.map((a) => ({
          questionId: new Types.ObjectId(a.questionId),
          selectedOptionId: a.selectedOptionId ? new Types.ObjectId(a.selectedOptionId) : null,
          isCorrect: a.isCorrect,
        })),
        correctCount: summary.correctCount,
        wrongCount: summary.wrongCount,
        skippedCount: summary.skippedCount,
        scorePercent: summary.scorePercent,
        isLate: completedAt.getTime() > deadline,
        completedAt,
      },
    },
    { returnDocument: "after" }
  );

  if (!completed) {
    // Lost the race to a concurrent submit - return what it stored.
    return toResultPayload(await findOwnSessionOrThrow(playerId, sessionId));
  }

  logger.info(
    { sessionId: completed._id.toString(), scorePercent: completed.scorePercent, isLate: completed.isLate },
    "safaricom_trivia session completed"
  );
  return toResultPayload(completed);
};
