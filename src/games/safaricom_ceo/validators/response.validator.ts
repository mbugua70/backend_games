import { z } from "zod";
import { objectIdSchema } from "./common.validator";

export const sessionQuestionParamSchema = z.object({
  sessionId: objectIdSchema("session id"),
  questionId: objectIdSchema("question id"),
});

export const submitResponseSchema = z.object({
  answerOptionId: objectIdSchema("answer option id"),
});
