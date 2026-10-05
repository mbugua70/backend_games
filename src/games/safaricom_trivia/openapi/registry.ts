import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { loginSchema, refreshSchema } from "../validators/auth.validator";
import { updateGameConfigSchema } from "../validators/gameConfig.validator";
import { registerPlayerSchema } from "../validators/player.validator";
import {
  bulkCreateQuestionsSchema,
  createQuestionSchema,
  listQuestionsQuerySchema,
  questionIdParamSchema,
  updateQuestionSchema,
} from "../validators/question.validator";
import { leaderboardQuerySchema, listPlayersQuerySchema } from "../validators/results.validator";
import { sessionIdParamSchema, submitSessionSchema } from "../validators/session.validator";

// Idempotent re-patch of Zod's shared prototype - see safaricom_ceo's
// registry for why calling this again per game is safe.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const bearerAuth = [{ bearerAuth: [] }];

const successEnvelope = (dataSchema: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: dataSchema,
  });

const ErrorResponse = registry.register(
  "SafaricomTriviaErrorResponse",
  z.object({
    success: z.literal(false),
    message: z.string(),
  })
);

const errorResponses = {
  400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
  401: { description: "Missing/invalid credentials or token", content: { "application/json": { schema: ErrorResponse } } },
  403: { description: "Insufficient permissions", content: { "application/json": { schema: ErrorResponse } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  409: { description: "This phone has already played", content: { "application/json": { schema: ErrorResponse } } },
  429: { description: "Rate limit exceeded", content: { "application/json": { schema: ErrorResponse } } },
  503: { description: "Game not set up yet (no organization or no questions)", content: { "application/json": { schema: ErrorResponse } } },
};

const jsonBody = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

const ok = (description: string, data: z.ZodTypeAny = z.unknown()) => ({
  description,
  content: { "application/json": { schema: successEnvelope(data) } },
});

const GameConfig = z.object({
  questionsPerGame: z.number(),
  questionTimeLimitMs: z.number(),
  totalTimeLimitMs: z.number(),
  answerColors: z.array(z.string()),
});

const PlaySession = z.object({
  session: z.object({
    id: z.string(),
    status: z.enum(["IN_PROGRESS", "COMPLETED"]),
    startedAt: z.string(),
    totalTimeLimitMs: z.number(),
  }),
  serverTime: z.string(),
  config: GameConfig,
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      options: z.array(z.object({ id: z.string(), text: z.string() })),
      correctOptionId: z.string(),
    })
  ),
});

const SessionResult = z.object({
  sessionId: z.string(),
  totalQuestions: z.number(),
  correctCount: z.number(),
  wrongCount: z.number(),
  skippedCount: z.number(),
  scorePercent: z.number(),
  isLate: z.boolean(),
  completedAt: z.string().nullable(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionId: z.string().nullable(),
      correctOptionId: z.string(),
      isCorrect: z.boolean(),
    })
  ),
});

const ADMIN_BASE = "/api/admin/safaricom_trivia/v1";
const PUBLIC_BASE = "/api/safaricom_trivia/v1";

// ---- Public (player-facing) ----

registry.registerPath({
  method: "get",
  tags: ["Game"],
  path: `${PUBLIC_BASE}/config`,
  responses: { 200: ok("Game config (timers, colours, question count)", GameConfig), ...errorResponses },
});

registry.registerPath({
  method: "post",
  tags: ["Game"],
  path: `${PUBLIC_BASE}/players`,
  description:
    "Registers a player by name + Kenyan phone. A phone that registered before but hasn't finished " +
    "its game gets 200 and a fresh token (to resume); a phone whose game is finished gets 409.",
  request: { body: jsonBody(registerPlayerSchema) },
  responses: {
    201: ok(
      "Player registered",
      z.object({ player: z.object({ id: z.string(), name: z.string() }), token: z.string() })
    ),
    200: ok("Existing player with an unfinished game - resume"),
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Game"],
  path: `${PUBLIC_BASE}/sessions`,
  description:
    "Starts the player's one game, or returns it unchanged if already in progress. Questions include " +
    "correctOptionId so the client can reveal answers without a request per answer.",
  security: bearerAuth,
  responses: { 200: ok("Session with its questions", PlaySession), ...errorResponses },
});

registry.registerPath({
  method: "post",
  tags: ["Game"],
  path: `${PUBLIC_BASE}/sessions/{sessionId}/submit`,
  description:
    "Submits the options the player picked; the server computes the score. Unanswered questions " +
    "count as skipped. Idempotent: once completed, any further submit returns the stored result.",
  security: bearerAuth,
  request: { params: sessionIdParamSchema, body: jsonBody(submitSessionSchema) },
  responses: { 200: ok("Scored result", SessionResult), ...errorResponses },
});

// ---- Admin auth ----

registry.registerPath({
  method: "post",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/login`,
  request: { body: jsonBody(loginSchema) },
  responses: {
    200: ok("Logged in", z.object({ accessToken: z.string(), refreshToken: z.string(), admin: z.unknown() })),
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/refresh`,
  request: { body: jsonBody(refreshSchema) },
  responses: { 200: ok("Access token refreshed", z.object({ accessToken: z.string() })), ...errorResponses },
});

registry.registerPath({
  method: "get",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/me`,
  security: bearerAuth,
  responses: { 200: ok("Current admin"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/logout`,
  security: bearerAuth,
  responses: { 200: ok("Logged out (stateless - the client discards its tokens)", z.null()), ...errorResponses },
});

// ---- Admin questions ----

registry.registerPath({
  method: "get",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions`,
  security: bearerAuth,
  request: { query: listQuestionsQuerySchema },
  responses: { 200: ok("Questions, with their correct answers"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions`,
  description: "SUPER_ADMIN only. correctOptionIndex is the 0-based position of the right answer in options.",
  security: bearerAuth,
  request: { body: jsonBody(createQuestionSchema) },
  responses: { 201: ok("Question created"), ...errorResponses },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions/bulk`,
  description: "SUPER_ADMIN only. Up to 500 questions; the whole batch is validated before any is saved.",
  security: bearerAuth,
  request: { body: jsonBody(bulkCreateQuestionsSchema) },
  responses: { 201: ok("Questions created", z.object({ createdCount: z.number() })), ...errorResponses },
});

registry.registerPath({
  method: "get",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions/{questionId}`,
  security: bearerAuth,
  request: { params: questionIdParamSchema },
  responses: { 200: ok("Question"), ...errorResponses },
});

registry.registerPath({
  method: "patch",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions/{questionId}`,
  description:
    "SUPER_ADMIN only. Replacing options requires correctOptionIndex. Games already in progress keep " +
    "the version of the question they started with.",
  security: bearerAuth,
  request: { params: questionIdParamSchema, body: jsonBody(updateQuestionSchema) },
  responses: { 200: ok("Question updated"), ...errorResponses },
});

registry.registerPath({
  method: "delete",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions/{questionId}`,
  description: "SUPER_ADMIN only. Soft delete - the question is deactivated and never drawn again.",
  security: bearerAuth,
  request: { params: questionIdParamSchema },
  responses: { 200: ok("Question deactivated"), ...errorResponses },
});

// ---- Admin config & results ----

registry.registerPath({
  method: "get",
  tags: ["Admin Config"],
  path: `${ADMIN_BASE}/config`,
  security: bearerAuth,
  responses: { 200: ok("Game config", GameConfig), ...errorResponses },
});

registry.registerPath({
  method: "patch",
  tags: ["Admin Config"],
  path: `${ADMIN_BASE}/config`,
  description: "SUPER_ADMIN only. Applies to games started after the change.",
  security: bearerAuth,
  request: { body: jsonBody(updateGameConfigSchema) },
  responses: { 200: ok("Game config updated", GameConfig), ...errorResponses },
});

registry.registerPath({
  method: "get",
  tags: ["Admin Results"],
  path: `${ADMIN_BASE}/players`,
  description: "Every registered player, newest first, with their game status and score.",
  security: bearerAuth,
  request: { query: listPlayersQuerySchema },
  responses: { 200: ok("Paginated players"), ...errorResponses },
});

registry.registerPath({
  method: "get",
  tags: ["Admin Results"],
  path: `${ADMIN_BASE}/leaderboard`,
  description: "Completed games, highest score first, ties broken by fastest finish.",
  security: bearerAuth,
  request: { query: leaderboardQuerySchema },
  responses: { 200: ok("Leaderboard"), ...errorResponses },
});
