import { Types } from "mongoose";
import { AppError } from "../../../core/utils/AppError";
import { Question, QuestionDocument } from "../models/Question";
import { CreateQuestionInput, UpdateQuestionInput } from "../validators/question.validator";

// Admin-only shape (includes the correct answer). The public, in-game
// question shape lives in services/session.service.ts and is built from
// the session's own snapshot, not from this.
export interface AdminQuestionPayload {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  correctOptionIndex: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toAdminQuestionPayload = (question: QuestionDocument): AdminQuestionPayload => {
  const correctOptionId = question.correctOptionId.toString();
  return {
    id: question._id.toString(),
    text: question.text,
    options: question.options.map((option) => ({ id: option._id.toString(), text: option.text })),
    correctOptionId,
    correctOptionIndex: question.options.findIndex((o) => o._id.toString() === correctOptionId),
    isActive: question.isActive,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
};

// Option ids are generated here (not left to Mongoose on save) so the
// correct one can be referenced in the same write.
const buildOptions = (
  texts: string[],
  correctOptionIndex: number
): { options: { _id: Types.ObjectId; text: string }[]; correctOptionId: Types.ObjectId } => {
  const options = texts.map((text) => ({ _id: new Types.ObjectId(), text }));
  const correct = options[correctOptionIndex];
  if (!correct) {
    throw new AppError("correctOptionIndex must point at one of the options", 422);
  }
  return { options, correctOptionId: correct._id };
};

export const listQuestions = async (
  organizationId: string,
  isActive?: boolean
): Promise<AdminQuestionPayload[]> => {
  const filter: Record<string, unknown> = { organizationId };
  if (isActive !== undefined) {
    filter.isActive = isActive;
  }
  const questions = await Question.find(filter).sort({ createdAt: 1 });
  return questions.map(toAdminQuestionPayload);
};

const findQuestionOrThrow = async (
  organizationId: string,
  questionId: string
): Promise<QuestionDocument> => {
  const question = await Question.findOne({ _id: questionId, organizationId });
  if (!question) {
    throw new AppError("Question not found", 404);
  }
  return question;
};

export const getQuestion = async (
  organizationId: string,
  questionId: string
): Promise<AdminQuestionPayload> =>
  toAdminQuestionPayload(await findQuestionOrThrow(organizationId, questionId));

const toQuestionDoc = (organizationId: string, input: CreateQuestionInput) => ({
  organizationId,
  text: input.text,
  isActive: input.isActive,
  ...buildOptions(input.options, input.correctOptionIndex),
});

export const createQuestion = async (
  organizationId: string,
  input: CreateQuestionInput
): Promise<AdminQuestionPayload> => {
  const question = await Question.create(toQuestionDoc(organizationId, input));
  return toAdminQuestionPayload(question);
};

// All-or-nothing from the admin's point of view: every question is
// validated by Zod before this runs, so insertMany only fails on a DB
// error, not on one bad row halfway through.
export const bulkCreateQuestions = async (
  organizationId: string,
  inputs: CreateQuestionInput[]
): Promise<{ createdCount: number }> => {
  const created = await Question.insertMany(inputs.map((input) => toQuestionDoc(organizationId, input)));
  return { createdCount: created.length };
};

export const updateQuestion = async (
  organizationId: string,
  questionId: string,
  input: UpdateQuestionInput
): Promise<AdminQuestionPayload> => {
  const question = await findQuestionOrThrow(organizationId, questionId);

  if (input.text !== undefined) {
    question.text = input.text;
  }
  if (input.isActive !== undefined) {
    question.isActive = input.isActive;
  }

  if (input.options !== undefined && input.correctOptionIndex !== undefined) {
    const { options, correctOptionId } = buildOptions(input.options, input.correctOptionIndex);
    question.set("options", options);
    question.correctOptionId = correctOptionId;
  } else if (input.correctOptionIndex !== undefined) {
    const option = question.options[input.correctOptionIndex];
    if (!option) {
      throw new AppError("correctOptionIndex must point at one of the options", 422);
    }
    question.correctOptionId = option._id;
  }

  // Games already in progress are unaffected - each session plays from
  // its own snapshot of the question (see models/Session.ts).
  await question.save();
  return toAdminQuestionPayload(question);
};

// Soft delete: a deactivated question is never drawn again, but past
// sessions that played it keep their own snapshot regardless.
export const deactivateQuestion = async (
  organizationId: string,
  questionId: string
): Promise<AdminQuestionPayload> => {
  const question = await Question.findOneAndUpdate(
    { _id: questionId, organizationId },
    { $set: { isActive: false } },
    { returnDocument: "after" }
  );
  if (!question) {
    throw new AppError("Question not found", 404);
  }
  return toAdminQuestionPayload(question);
};
