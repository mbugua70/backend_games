import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone } from "../../src/games/safaricom_trivia/services/phone";
import { scoreAnswers, ScorableQuestion } from "../../src/games/safaricom_trivia/services/scoring.service";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["0712 345 678", "254712345678"],
    ["712345678", "254712345678"],
    ["+254712345678", "254712345678"],
    ["254-712-345-678", "254712345678"],
    ["0110123456", "254110123456"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0812345678", "07123456789", "abc0712345678", "+1 555 123 4567"])(
    "rejects %s",
    (input) => {
      expect(normalizeKenyanPhone(input)).toBeNull();
    }
  );
});

describe("scoreAnswers", () => {
  const questions: ScorableQuestion[] = [
    { questionId: "q1", optionIds: ["a", "b", "c"], correctOptionId: "a" },
    { questionId: "q2", optionIds: ["d", "e", "f"], correctOptionId: "e" },
    { questionId: "q3", optionIds: ["g", "h", "i"], correctOptionId: "i" },
  ];

  it("counts correct, wrong and skipped and rounds the percent", () => {
    const result = scoreAnswers(questions, [
      { questionId: "q1", selectedOptionId: "a" },
      { questionId: "q2", selectedOptionId: "d" },
      { questionId: "q3", selectedOptionId: null },
    ]);
    expect(result).toMatchObject({
      totalQuestions: 3,
      correctCount: 1,
      wrongCount: 1,
      skippedCount: 1,
      scorePercent: 33,
    });
  });

  it("treats questions with no submitted answer as skipped and keeps session order", () => {
    const result = scoreAnswers(questions, [{ questionId: "q3", selectedOptionId: "i" }]);
    expect(result.skippedCount).toBe(2);
    expect(result.correctCount).toBe(1);
    expect(result.answers.map((a) => a.questionId)).toEqual(["q1", "q2", "q3"]);
  });

  it("rejects an answer for a question not in the game", () => {
    expect(() => scoreAnswers(questions, [{ questionId: "qX", selectedOptionId: "a" }])).toThrow(
      /not in this game/
    );
  });

  it("rejects an option from a different question", () => {
    expect(() => scoreAnswers(questions, [{ questionId: "q1", selectedOptionId: "e" }])).toThrow(
      /does not belong/
    );
  });

  it("rejects answering the same question twice", () => {
    expect(() =>
      scoreAnswers(questions, [
        { questionId: "q1", selectedOptionId: "b" },
        { questionId: "q1", selectedOptionId: "a" },
      ])
    ).toThrow(/only be answered once/);
  });
});
