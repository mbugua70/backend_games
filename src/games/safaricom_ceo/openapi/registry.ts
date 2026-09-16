import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { listSessionsQuerySchema } from "../validators/adminSession.validator";
import { analyticsSummaryQuerySchema } from "../validators/analytics.validator";
import { loginSchema, refreshSchema } from "../validators/auth.validator";
import { registerParticipantSchema } from "../validators/participant.validator";
import {
  createProfileSchema,
  profileIdParamSchema,
  updateProfileSchema,
} from "../validators/profile.validator";
import {
  createQuestionSchema,
  questionIdParamSchema,
  updateQuestionSchema,
} from "../validators/question.validator";
import { sessionQuestionParamSchema, submitResponseSchema } from "../validators/response.validator";
import { sessionIdParamSchema, startSessionSchema } from "../validators/session.validator";

// Attaches `.openapi()` onto Zod's shared ZodType prototype - must run
// before any `.openapi()` call below. Safe to call again here even though
// jigsaw_puzzle/ar_basketball's registries already did it once for the
// process: it's idempotently re-patching the same shared prototype, not
// per-module state.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const bearerAuth = [{ bearerAuth: [] }];

// Every controller in this game responds via core/utils/response.ts's
// sendSuccess/sendError, so every route shares these two envelope shapes.
// `data` is left unknown rather than guessing at each service's exact DTO
// fields (those live in services/*.ts, not the Zod layer this registry is
// built from) - Swagger UI's "Try it out" still shows the real live JSON.
const successEnvelope = (dataSchema: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: dataSchema,
  });

const ErrorResponse = registry.register(
  "SafaricomCeoErrorResponse",
  z.object({
    success: z.literal(false),
    message: z.string(),
  })
);

const errorResponses = {
  400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
  401: { description: "Missing/invalid credentials or token", content: { "application/json": { schema: ErrorResponse } } },
  403: { description: "Insufficient permissions, or the target is not currently active", content: { "application/json": { schema: ErrorResponse } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  409: { description: "Conflict with current state", content: { "application/json": { schema: ErrorResponse } } },
  422: { description: "Well-formed request the current state can't satisfy", content: { "application/json": { schema: ErrorResponse } } },
  429: { description: "Rate limit exceeded", content: { "application/json": { schema: ErrorResponse } } },
};

const jsonBody = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

const ADMIN_BASE = "/api/admin/safaricom_ceo/v1";
const PUBLIC_BASE = "/api/safaricom_ceo/v1";

// ---- Admin auth ----

registry.registerPath({
  method: "post",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/login`,
  request: { body: jsonBody(loginSchema) },
  responses: {
    200: {
      description: "Logged in",
      content: {
        "application/json": {
          schema: successEnvelope(
            z.object({
              accessToken: z.string(),
              refreshToken: z.string(),
              admin: z.object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
                role: z.enum(["ADMIN", "SUPER_ADMIN"]),
                organizationId: z.string(),
              }),
            })
          ),
        },
      },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/refresh`,
  request: { body: jsonBody(refreshSchema) },
  responses: {
    200: {
      description: "Access token refreshed",
      content: { "application/json": { schema: successEnvelope(z.object({ accessToken: z.string() })) } },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/me`,
  security: bearerAuth,
  responses: {
    200: { description: "Current admin", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Auth"],
  path: `${ADMIN_BASE}/auth/logout`,
  security: bearerAuth,
  responses: {
    200: {
      description: "Logged out (stateless - the client discards both tokens; see auth.controller.ts)",
      content: { "application/json": { schema: successEnvelope(z.null()) } },
    },
    ...errorResponses,
  },
});

// ---- Admin questions ----

registry.registerPath({
  method: "get",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions`,
  security: bearerAuth,
  responses: {
    200: { description: "List questions (includes hidden option levels)", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions`,
  security: bearerAuth,
  request: { body: jsonBody(createQuestionSchema) },
  responses: {
    201: { description: "Question created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions/{questionId}`,
  security: bearerAuth,
  request: { params: questionIdParamSchema },
  responses: {
    200: { description: "Get question", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions/{questionId}`,
  security: bearerAuth,
  request: { params: questionIdParamSchema, body: jsonBody(updateQuestionSchema) },
  responses: {
    200: { description: "Question updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  tags: ["Admin Questions"],
  path: `${ADMIN_BASE}/questions/{questionId}`,
  security: bearerAuth,
  request: { params: questionIdParamSchema },
  responses: {
    200: { description: "Question deactivated (soft delete)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Admin profiles ----

registry.registerPath({
  method: "get",
  tags: ["Admin Profiles"],
  path: `${ADMIN_BASE}/profiles`,
  security: bearerAuth,
  responses: {
    200: { description: "List profiles", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Admin Profiles"],
  path: `${ADMIN_BASE}/profiles`,
  security: bearerAuth,
  request: { body: jsonBody(createProfileSchema) },
  responses: {
    201: { description: "Profile created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Admin Profiles"],
  path: `${ADMIN_BASE}/profiles/{profileId}`,
  security: bearerAuth,
  request: { params: profileIdParamSchema, body: jsonBody(updateProfileSchema) },
  responses: {
    200: { description: "Profile updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Admin sessions (read-only) ----

registry.registerPath({
  method: "get",
  tags: ["Admin Sessions"],
  path: `${ADMIN_BASE}/sessions`,
  security: bearerAuth,
  request: { query: listSessionsQuerySchema },
  responses: {
    200: { description: "Paginated session list", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Admin Sessions"],
  path: `${ADMIN_BASE}/sessions/{sessionId}`,
  security: bearerAuth,
  request: { params: sessionIdParamSchema },
  responses: {
    200: { description: "Session detail, including participant contact info and result", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Admin analytics ----

registry.registerPath({
  method: "get",
  tags: ["Admin Analytics"],
  path: `${ADMIN_BASE}/analytics/summary`,
  security: bearerAuth,
  request: { query: analyticsSummaryQuerySchema },
  responses: {
    200: { description: "Event-wide analytics summary (never includes phone/email)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Public participant-facing endpoints ----

registry.registerPath({
  method: "post",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/participants`,
  request: { body: jsonBody(registerParticipantSchema) },
  responses: {
    201: { description: "Participant registered", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    200: { description: "Participant already registered (Idempotency-Key replay)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/questions`,
  responses: {
    200: {
      description: "Active questions and options - hidden option levels are never included",
      content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } },
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/sessions`,
  request: { body: jsonBody(startSessionSchema) },
  responses: {
    201: { description: "Session started", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    200: { description: "Session already started (Idempotency-Key replay)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/sessions/{sessionId}`,
  request: { params: sessionIdParamSchema },
  responses: {
    200: { description: "Resume a session - answered question ids and selected option ids, no scores", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "put",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/sessions/{sessionId}/responses/{questionId}`,
  request: { params: sessionQuestionParamSchema, body: jsonBody(submitResponseSchema) },
  responses: {
    200: { description: "Answer recorded (creates or overwrites - PUT semantics)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/sessions/{sessionId}/complete`,
  request: { params: sessionIdParamSchema },
  responses: {
    200: { description: "Session completed (idempotent - replays the same result on retry)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/sessions/{sessionId}/result`,
  request: { params: sessionIdParamSchema },
  responses: {
    200: {
      description:
        "Participant-facing result. profile is null until the client approves real profile-selection rules - see services/profileResolver.service.ts",
      content: { "application/json": { schema: successEnvelope(z.unknown()) } },
    },
    ...errorResponses,
  },
});
