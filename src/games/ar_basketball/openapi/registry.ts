import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { loginSchema, refreshSchema } from "../validators/auth.validator";
import {
  createEventSchema,
  eventIdParamSchema as eventIdParamSchemaEvent,
  updateEventSchema,
} from "../validators/event.validator";
import { eventBrandingSchema, eventIdParamSchema as eventIdParamSchemaBranding } from "../validators/eventBranding.validator";
import { eventIdParamSchema as eventIdParamSchemaEventStats } from "../validators/eventStats.validator";
import {
  eventIdParamSchema as eventIdParamSchemaGameConfig,
  gameConfigSchema,
} from "../validators/gameConfig.validator";
import {
  eventIdParamSchema as eventIdParamSchemaGameSession,
  sessionIdParamSchema,
} from "../validators/gameSession.validator";
import {
  eventIdParamSchema as eventIdParamSchemaLeaderboard,
  leaderboardQuerySchema,
} from "../validators/leaderboard.validator";
import {
  eventIdParamSchema as eventIdParamSchemaLeaderboardConfig,
  leaderboardConfigSchema,
} from "../validators/leaderboardConfig.validator";
import {
  eventIdParamSchema as eventIdParamSchemaPlayer,
  playerIdParamSchema,
} from "../validators/player.validator";
import { eventCodeParamSchema, sessionUuidParamSchema } from "../validators/publicGameParams.validator";
import { completeSessionSchema, startSessionSchema } from "../validators/publicGameSession.validator";
import { registerPlayerSchema } from "../validators/publicPlayer.validator";
import {
  eventIdParamSchema as eventIdParamSchemaRegistrationConfig,
  registrationConfigSchema,
} from "../validators/registrationConfig.validator";

// Attaches `.openapi()` onto Zod's shared ZodType prototype - must run
// before any `.openapi()` call below. Safe to call again here even though
// jigsaw_puzzle's registry already did it once for the process: it's
// idempotently re-patching the same shared prototype, not per-module state.
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
// fields (which live in services/*.ts, not the Zod layer this registry is
// built from) - Swagger UI's "Try it out" still shows the real live JSON.
const successEnvelope = (dataSchema: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: dataSchema,
  });

const ErrorResponse = registry.register(
  "ArBasketballErrorResponse",
  z.object({
    success: z.literal(false),
    message: z.string(),
  })
);

const errorResponses = {
  400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
  401: { description: "Missing/invalid credentials or token", content: { "application/json": { schema: ErrorResponse } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
};

const jsonBody = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

const ADMIN_BASE = "/api/admin/ar_basketball/v1";
const PUBLIC_BASE = "/api/ar_basketball/v1";

// ---- Auth ----

registry.registerPath({
  method: "post",
  tags: ["Auth"],
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
                username: z.string(),
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
  tags: ["Auth"],
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
  tags: ["Auth"],
  path: `${ADMIN_BASE}/auth/me`,
  security: bearerAuth,
  responses: {
    200: { description: "Current admin", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Events (admin) ----

registry.registerPath({
  method: "post",
  tags: ["Events"],
  path: `${ADMIN_BASE}/events`,
  security: bearerAuth,
  request: { body: jsonBody(createEventSchema) },
  responses: {
    201: { description: "Event created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Events"],
  path: `${ADMIN_BASE}/events`,
  security: bearerAuth,
  responses: {
    200: { description: "List events", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Events"],
  path: `${ADMIN_BASE}/events/{id}`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaEvent },
  responses: {
    200: { description: "Get event", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "put",
  tags: ["Events"],
  path: `${ADMIN_BASE}/events/{id}`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaEvent, body: jsonBody(updateEventSchema) },
  responses: {
    200: { description: "Event updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "delete",
  tags: ["Events"],
  path: `${ADMIN_BASE}/events/{id}`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaEvent },
  responses: {
    200: { description: "Event deleted", content: { "application/json": { schema: successEnvelope(z.object({ id: z.string() })) } } },
    ...errorResponses,
  },
});

// ---- Branding (admin, nested under an event) ----

registry.registerPath({
  method: "post",
  tags: ["Branding"],
  path: `${ADMIN_BASE}/events/{eventId}/branding`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaBranding, body: jsonBody(eventBrandingSchema) },
  responses: {
    201: { description: "Branding created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Branding"],
  path: `${ADMIN_BASE}/events/{eventId}/branding`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaBranding },
  responses: {
    200: { description: "Get branding", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "put",
  tags: ["Branding"],
  path: `${ADMIN_BASE}/events/{eventId}/branding`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaBranding, body: jsonBody(eventBrandingSchema) },
  responses: {
    200: { description: "Branding updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Registration config (admin, nested under an event) ----

registry.registerPath({
  method: "post",
  tags: ["Registration Config"],
  path: `${ADMIN_BASE}/events/{eventId}/registration-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaRegistrationConfig, body: jsonBody(registrationConfigSchema) },
  responses: {
    201: { description: "Registration config created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Registration Config"],
  path: `${ADMIN_BASE}/events/{eventId}/registration-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaRegistrationConfig },
  responses: {
    200: { description: "Get registration config", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "put",
  tags: ["Registration Config"],
  path: `${ADMIN_BASE}/events/{eventId}/registration-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaRegistrationConfig, body: jsonBody(registrationConfigSchema) },
  responses: {
    200: { description: "Registration config updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Game config (admin, nested under an event) ----

registry.registerPath({
  method: "post",
  tags: ["Game Config"],
  path: `${ADMIN_BASE}/events/{eventId}/game-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaGameConfig, body: jsonBody(gameConfigSchema) },
  responses: {
    201: { description: "Game config created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Game Config"],
  path: `${ADMIN_BASE}/events/{eventId}/game-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaGameConfig },
  responses: {
    200: { description: "Get game config", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "put",
  tags: ["Game Config"],
  path: `${ADMIN_BASE}/events/{eventId}/game-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaGameConfig, body: jsonBody(gameConfigSchema) },
  responses: {
    200: { description: "Game config updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Leaderboard config (admin, nested under an event) ----

registry.registerPath({
  method: "post",
  tags: ["Leaderboard Config"],
  path: `${ADMIN_BASE}/events/{eventId}/leaderboard-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaLeaderboardConfig, body: jsonBody(leaderboardConfigSchema) },
  responses: {
    201: { description: "Leaderboard config created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Leaderboard Config"],
  path: `${ADMIN_BASE}/events/{eventId}/leaderboard-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaLeaderboardConfig },
  responses: {
    200: { description: "Get leaderboard config", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "put",
  tags: ["Leaderboard Config"],
  path: `${ADMIN_BASE}/events/{eventId}/leaderboard-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaLeaderboardConfig, body: jsonBody(leaderboardConfigSchema) },
  responses: {
    200: { description: "Leaderboard config updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Players (admin, read-only) ----

registry.registerPath({
  method: "get",
  tags: ["Players"],
  path: `${ADMIN_BASE}/events/{eventId}/players`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaPlayer },
  responses: {
    200: { description: "List players", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Players"],
  path: `${ADMIN_BASE}/events/{eventId}/players/{playerId}`,
  security: bearerAuth,
  request: { params: playerIdParamSchema },
  responses: {
    200: { description: "Get player", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Game sessions (admin, read-only) ----

registry.registerPath({
  method: "get",
  tags: ["Sessions"],
  path: `${ADMIN_BASE}/events/{eventId}/sessions`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaGameSession },
  responses: {
    200: { description: "List sessions", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Sessions"],
  path: `${ADMIN_BASE}/events/{eventId}/sessions/{sessionId}`,
  security: bearerAuth,
  request: { params: sessionIdParamSchema },
  responses: {
    200: { description: "Get session", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Leaderboard (admin) ----

registry.registerPath({
  method: "get",
  tags: ["Leaderboard"],
  path: `${ADMIN_BASE}/events/{eventId}/leaderboard`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaLeaderboard, query: leaderboardQuerySchema },
  responses: {
    200: { description: "Get leaderboard", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

// ---- Event stats / analytics (admin) ----

registry.registerPath({
  method: "get",
  tags: ["Stats"],
  path: `${ADMIN_BASE}/events/{eventId}/stats`,
  security: bearerAuth,
  request: { params: eventIdParamSchemaEventStats },
  responses: {
    200: { description: "Get event analytics", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Public mobile-client endpoints (no auth, scoped by event code) ----

registry.registerPath({
  method: "get",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/events/{code}`,
  request: { params: eventCodeParamSchema },
  responses: {
    200: {
      description: "Event + branding + registration/game/leaderboard config for the mobile client",
      content: {
        "application/json": {
          schema: successEnvelope(
            z.object({
              event: z.unknown(),
              branding: z.unknown(),
              registrationConfig: z.unknown(),
              gameConfig: z.unknown(),
              leaderboardConfig: z.unknown(),
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
  tags: ["Public"],
  path: `${PUBLIC_BASE}/events/{code}/players`,
  request: { params: eventCodeParamSchema, body: jsonBody(registerPlayerSchema) },
  responses: {
    201: { description: "Player registered", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/events/{code}/sessions`,
  request: { params: eventCodeParamSchema, body: jsonBody(startSessionSchema) },
  responses: {
    201: { description: "Session started", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    200: { description: "Session already started (idempotent replay)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/sessions/{sessionUuid}/complete`,
  request: { params: sessionUuidParamSchema, body: jsonBody(completeSessionSchema) },
  responses: {
    200: { description: "Session completed", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/events/{code}/leaderboard`,
  request: { params: eventCodeParamSchema, query: leaderboardQuerySchema },
  responses: {
    200: { description: "Public leaderboard", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});
