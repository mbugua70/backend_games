import { Question, QuestionDocument } from "../models/Question";
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
