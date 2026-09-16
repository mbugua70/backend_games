import { AppError } from "../../../core/utils/AppError";
import { Question } from "../models/Question";
import { Session } from "../models/Session";
import { getPublicOrganization } from "./organization.service";
import { SessionPayload, toSessionPayload } from "./session.service";

// PUT semantics: while the session is IN_PROGRESS, re-submitting an answer
// for the same question overwrites it in place (no duplicate response, no
// history of prior picks) rather than accumulating a log of every tap.
export const upsertResponse = async (
  sessionId: string,
  questionId: string,
  answerOptionId: string
): Promise<SessionPayload> => {
  const organization = await getPublicOrganization();

  const session = await Session.findOne({ _id: sessionId, organizationId: organization._id });
  if (!session) {
    throw new AppError("Session not found", 404);
  }
  if (session.status !== "IN_PROGRESS") {
    throw new AppError("Session is not in progress", 409);
  }

  const question = await Question.findOne({ _id: questionId, organizationId: organization._id });
  if (!question) {
    throw new AppError("Question not found", 404);
  }
  if (!question.isActive) {
    throw new AppError("Question is not currently active", 403);
  }

  const option = question.options.id(answerOptionId);
  if (!option) {
    throw new AppError("Answer option not found for this question", 404);
  }
  if (!option.isActive) {
    throw new AppError("Answer option is not currently active", 403);
  }

  // The backend looks up the option's hidden level and stores that as the
  // score - the client only ever sends answerOptionId, never a score.
  const now = new Date();
  const responseFields = {
    answerOptionId: option._id,
    dimension: question.dimension,
    score: option.level,
    answeredAt: now,
  };

  // Two-step atomic upsert of the embedded response, so a retried request
  // (dropped response at a busy event) can never create a duplicate entry
  // for the same question: first try updating an existing element for this
  // question; only if none exists, push a new one, still guarded by
  // status: IN_PROGRESS and "no element for this question yet" so two
  // concurrent first-time submits for the same question can't both push.
  const updated = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      organizationId: organization._id,
      status: "IN_PROGRESS",
      "responses.questionId": question._id,
    },
    {
      $set: {
        "responses.$.answerOptionId": responseFields.answerOptionId,
        "responses.$.dimension": responseFields.dimension,
        "responses.$.score": responseFields.score,
        "responses.$.answeredAt": responseFields.answeredAt,
      },
    },
    { new: true }
  );
  if (updated) {
    return toSessionPayload(updated);
  }

  const inserted = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      organizationId: organization._id,
      status: "IN_PROGRESS",
      "responses.questionId": { $ne: question._id },
    },
    { $push: { responses: { questionId: question._id, ...responseFields } } },
    { new: true }
  );
  if (inserted) {
    return toSessionPayload(inserted);
  }

  // Neither atomic update matched: the session was completed/abandoned, or
  // another concurrent submit for this exact question just landed, in the
  // narrow gap between the two attempts above. Re-fetch for a consistent,
  // current view rather than a stale/incorrect error.
  const current = await Session.findOne({ _id: sessionId, organizationId: organization._id });
  if (!current) {
    throw new AppError("Session not found", 404);
  }
  if (current.status !== "IN_PROGRESS") {
    throw new AppError("Session is not in progress", 409);
  }
  return toSessionPayload(current);
};
