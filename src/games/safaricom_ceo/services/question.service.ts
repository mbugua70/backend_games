import { AppError } from "../../../core/utils/AppError";
import { Dimension, Question, QuestionDocument } from "../models/Question";
import { getPublicOrganization } from "./organization.service";

export interface PublicAnswerOptionPayload {
  id: string;
  text: string;
  order: number;
}

export interface PublicQuestionPayload {
  id: string;
  dimension: string;
  text: string;
  order: number;
  options: PublicAnswerOptionPayload[];
}

// Never includes AnswerOption.level - the hidden 1-5 score is exactly what
// the participant-facing endpoint must not leak.
const toPublicQuestionPayload = (question: QuestionDocument): PublicQuestionPayload => ({
  id: question._id.toString(),
  dimension: question.dimension,
  text: question.text,
  order: question.order,
  options: question.options
    .filter((option) => option.isActive)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((option) => ({
      id: option._id.toString(),
      text: option.text,
      order: option.order,
    })),
});

export const listPublicQuestions = async (): Promise<PublicQuestionPayload[]> => {
  const organization = await getPublicOrganization();
  const questions = await Question.find({
    organizationId: organization._id,
    isActive: true,
  }).sort({ order: 1 });
  return questions.map(toPublicQuestionPayload);
};

// ---- Admin (includes the hidden level - never reused for a public route) ----

export interface AdminAnswerOptionPayload {
  id: string;
  text: string;
  level: number;
  order: number;
  isActive: boolean;
}

export interface AdminQuestionPayload {
  id: string;
  dimension: Dimension;
  text: string;
  order: number;
  isActive: boolean;
  options: AdminAnswerOptionPayload[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AnswerOptionInput {
  text: string;
  level: number;
  order: number;
  isActive: boolean;
}

export interface CreateQuestionInput {
  dimension: Dimension;
  text: string;
  order: number;
  isActive: boolean;
  options: AnswerOptionInput[];
}

export interface UpdateQuestionInput {
  dimension?: Dimension;
  text?: string;
  order?: number;
  isActive?: boolean;
  options?: AnswerOptionInput[];
}

const toAdminQuestionPayload = (question: QuestionDocument): AdminQuestionPayload => ({
  id: question._id.toString(),
  dimension: question.dimension,
  text: question.text,
  order: question.order,
  isActive: question.isActive,
  options: question.options
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((option) => ({
      id: (option._id ?? "").toString(),
      text: option.text,
      level: option.level,
      order: option.order,
      isActive: option.isActive,
    })),
  createdAt: question.createdAt,
  updatedAt: question.updatedAt,
});

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

const assertUniqueOptionOrders = (options: AnswerOptionInput[]): void => {
  const orders = new Set(options.map((o) => o.order));
  if (orders.size !== options.length) {
    throw new AppError("Option order must be unique within a question", 422);
  }
};

// "Do not allow a question to become active unless it has exactly 5 valid
// active options with levels 1-5" - interpreted strictly as one option per
// level, so the game's 5-rung ladder is always well-defined for a live
// question.
const assertActivatable = (options: AnswerOptionInput[]): void => {
  const activeOptions = options.filter((o) => o.isActive);
  if (activeOptions.length !== 5) {
    throw new AppError("A question can only be activated with exactly 5 active options", 422);
  }
  const levels = activeOptions.map((o) => o.level).sort((a, b) => a - b);
  const hasEveryLevelOnce = [1, 2, 3, 4, 5].every((level, i) => levels[i] === level);
  if (!hasEveryLevelOnce) {
    throw new AppError(
      "A question's 5 active options must have levels 1, 2, 3, 4, and 5 - one option per level",
      422
    );
  }
};

export const listAdminQuestions = async (organizationId: string): Promise<AdminQuestionPayload[]> => {
  const questions = await Question.find({ organizationId }).sort({ order: 1 });
  return questions.map(toAdminQuestionPayload);
};

export const getAdminQuestionById = async (
  organizationId: string,
  questionId: string
): Promise<AdminQuestionPayload> => {
  const question = await Question.findOne({ _id: questionId, organizationId });
  if (!question) {
    throw new AppError("Question not found", 404);
  }
  return toAdminQuestionPayload(question);
};

export const createQuestion = async (
  organizationId: string,
  input: CreateQuestionInput
): Promise<AdminQuestionPayload> => {
  assertUniqueOptionOrders(input.options);
  if (input.isActive) {
    assertActivatable(input.options);
  }

  try {
    const question = await Question.create({
      organizationId,
      dimension: input.dimension,
      text: input.text,
      order: input.order,
      isActive: input.isActive,
      options: input.options,
    });
    return toAdminQuestionPayload(question);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(
        "A question for this dimension, or at this order, already exists for this organization",
        409
      );
    }
    throw err;
  }
};

export const updateQuestion = async (
  organizationId: string,
  questionId: string,
  input: UpdateQuestionInput
): Promise<AdminQuestionPayload> => {
  const question = await Question.findOne({ _id: questionId, organizationId });
  if (!question) {
    throw new AppError("Question not found", 404);
  }

  const nextOptions: AnswerOptionInput[] =
    input.options ??
    question.options.map((o) => ({ text: o.text, level: o.level, order: o.order, isActive: o.isActive }));
  const nextIsActive = input.isActive ?? question.isActive;

  assertUniqueOptionOrders(nextOptions);
  if (nextIsActive) {
    assertActivatable(nextOptions);
  }

  if (input.dimension !== undefined) {
    question.dimension = input.dimension;
  }
  if (input.text !== undefined) {
    question.text = input.text;
  }
  if (input.order !== undefined) {
    question.order = input.order;
  }
  if (input.options !== undefined) {
    question.options.splice(0, question.options.length, ...input.options);
  }
  question.isActive = nextIsActive;

  try {
    await question.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(
        "A question for this dimension, or at this order, already exists for this organization",
        409
      );
    }
    throw err;
  }

  return toAdminQuestionPayload(question);
};

// Soft delete - deactivates rather than removes, so historical Session
// responses that reference this question stay explainable (see CLAUDE.md's
// preference for deactivation over destructive deletes of historical data).
export const deactivateQuestion = async (
  organizationId: string,
  questionId: string
): Promise<AdminQuestionPayload> => {
  const question = await Question.findOneAndUpdate(
    { _id: questionId, organizationId },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!question) {
    throw new AppError("Question not found", 404);
  }
  return toAdminQuestionPayload(question);
};
