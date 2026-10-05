import { AppError } from "../../../core/utils/AppError";

export interface ScorableQuestion {
  questionId: string;
  optionIds: string[];
  correctOptionId: string;
}

export interface SubmittedAnswer {
  questionId: string;
  selectedOptionId: string | null;
}

export interface ScoredAnswer {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
}

export interface ScoreSummary {
  answers: ScoredAnswer[];
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  scorePercent: number;
}

// Pure (no DB) so it can be unit-tested directly. The client only ever
// says *which option it picked* - correctness and the score are decided
// here against the session's own snapshot of the correct answers, never
// taken from the request.
//
// A question the client didn't send an answer for counts as skipped, the
// same as an explicit null (the frontend's timeout path). Answers are
// returned in the session's question order, not the order submitted.
export const scoreAnswers = (
  questions: ScorableQuestion[],
  submitted: SubmittedAnswer[]
): ScoreSummary => {
  const byQuestionId = new Map(questions.map((q) => [q.questionId, q]));
  const selections = new Map<string, string | null>();

  for (const answer of submitted) {
    const question = byQuestionId.get(answer.questionId);
    if (!question) {
      throw new AppError("Answer submitted for a question not in this game", 400);
    }
    if (selections.has(answer.questionId)) {
      throw new AppError("Each question may only be answered once", 400);
    }
    if (answer.selectedOptionId !== null && !question.optionIds.includes(answer.selectedOptionId)) {
      throw new AppError("Selected option does not belong to its question", 400);
    }
    selections.set(answer.questionId, answer.selectedOptionId);
  }

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const answers = questions.map((question): ScoredAnswer => {
    const selectedOptionId = selections.get(question.questionId) ?? null;
    const isCorrect = selectedOptionId === question.correctOptionId;
    if (selectedOptionId === null) {
      skippedCount += 1;
    } else if (isCorrect) {
      correctCount += 1;
    } else {
      wrongCount += 1;
    }
    return {
      questionId: question.questionId,
      selectedOptionId,
      correctOptionId: question.correctOptionId,
      isCorrect,
    };
  });

  const totalQuestions = questions.length;
  // Same rounding the original frontend's Summary screen used.
  const scorePercent = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);

  return { answers, totalQuestions, correctCount, wrongCount, skippedCount, scorePercent };
};
