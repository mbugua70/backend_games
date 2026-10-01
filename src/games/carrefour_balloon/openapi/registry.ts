import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { loginSchema, refreshSchema } from "../validators/auth.validator";
import { createBrandSchema, updateBrandSchema } from "../validators/brand.validator";
import {
  eventAndBrandIdParamSchema,
  eventAndEntryIdParamSchema,
  eventAndGiftIdParamSchema,
  eventAndPoolIdParamSchema,
  eventAndWinIdParamSchema,
  eventIdParamSchema,
  poolAndEntryIdParamSchema,
} from "../validators/common.validator";
import { createEventSchema, switchGiftPoolModeSchema, updateEventSchema } from "../validators/event.validator";
import { gameConfigQuerySchema } from "../validators/gameConfig.validator";
import { createGiftSchema, listGiftsQuerySchema, updateGiftSchema } from "../validators/gift.validator";
import { createPoolSchema, updatePoolSchema } from "../validators/giftPool.validator";
import {
  adjustStockSchema,
  createGiftPoolEntrySchema,
  updateGiftPoolEntrySchema,
} from "../validators/giftPoolEntry.validator";
import { registerParticipantSchema } from "../validators/participant.validator";
import { updateRegistrationConfigSchema } from "../validators/registrationConfig.validator";
import { listStockAdjustmentsQuerySchema } from "../validators/stockAdjustment.validator";
import { adminListWinsQuerySchema, recordWinSchema } from "../validators/win.validator";

// Attaches `.openapi()` onto Zod's shared ZodType prototype - must run
// before any `.openapi()` call below. Safe to call again even though
// another game's registry already did it once for the process (see
// ar_basketball/openapi/registry.ts's identical comment).
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
const successEnvelope = (dataSchema: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: dataSchema,
  });

const ErrorResponse = registry.register(
  "CarrefourBalloonErrorResponse",
  z.object({
    success: z.literal(false),
    message: z.string(),
  })
);

const errorResponses = {
  400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
  401: { description: "Missing/invalid credentials or token", content: { "application/json": { schema: ErrorResponse } } },
  404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  409: { description: "Conflict (duplicate/out of stock/already claimed)", content: { "application/json": { schema: ErrorResponse } } },
};

const jsonBody = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });

const ADMIN_BASE = "/api/admin/carrefour_balloon/v1";
const PUBLIC_BASE = "/api/carrefour_balloon/v1";

// ---- Auth ----

registry.registerPath({
  method: "post",
  tags: ["Auth"],
  path: `${ADMIN_BASE}/auth/login`,
  request: { body: jsonBody(loginSchema) },
  responses: {
    200: { description: "Logged in", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Auth"],
  path: `${ADMIN_BASE}/auth/refresh`,
  request: { body: jsonBody(refreshSchema) },
  responses: {
    200: { description: "Access token refreshed", content: { "application/json": { schema: successEnvelope(z.object({ accessToken: z.string() })) } } },
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
  path: `${ADMIN_BASE}/events/{eventId}`,
  security: bearerAuth,
  request: { params: eventIdParamSchema },
  responses: {
    200: { description: "Get event", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Events"],
  path: `${ADMIN_BASE}/events/{eventId}`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, body: jsonBody(updateEventSchema) },
  responses: {
    200: { description: "Event updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Events"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pool-mode`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, body: jsonBody(switchGiftPoolModeSchema) },
  responses: {
    200: { description: "Gift pool mode switched", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Brands (admin) ----

registry.registerPath({
  method: "get",
  tags: ["Brands"],
  path: `${ADMIN_BASE}/events/{eventId}/brands`,
  security: bearerAuth,
  request: { params: eventIdParamSchema },
  responses: {
    200: { description: "List brands", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Brands"],
  path: `${ADMIN_BASE}/events/{eventId}/brands`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, body: jsonBody(createBrandSchema) },
  responses: {
    201: { description: "Brand created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Brands"],
  path: `${ADMIN_BASE}/events/{eventId}/brands/{brandId}`,
  security: bearerAuth,
  request: { params: eventAndBrandIdParamSchema, body: jsonBody(updateBrandSchema) },
  responses: {
    200: { description: "Brand updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Registration config (admin) ----

registry.registerPath({
  method: "get",
  tags: ["Registration Config"],
  path: `${ADMIN_BASE}/events/{eventId}/registration-config`,
  security: bearerAuth,
  request: { params: eventIdParamSchema },
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
  request: { params: eventIdParamSchema, body: jsonBody(updateRegistrationConfigSchema) },
  responses: {
    200: { description: "Registration config updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Gifts (admin catalog) ----

registry.registerPath({
  method: "get",
  tags: ["Gifts"],
  path: `${ADMIN_BASE}/events/{eventId}/gifts`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, query: listGiftsQuerySchema },
  responses: {
    200: { description: "List gifts", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Gifts"],
  path: `${ADMIN_BASE}/events/{eventId}/gifts`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, body: jsonBody(createGiftSchema) },
  responses: {
    201: { description: "Gift created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Gifts"],
  path: `${ADMIN_BASE}/events/{eventId}/gifts/{giftId}`,
  security: bearerAuth,
  request: { params: eventAndGiftIdParamSchema, body: jsonBody(updateGiftSchema) },
  responses: {
    200: { description: "Gift updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Gifts"],
  path: `${ADMIN_BASE}/events/{eventId}/gifts/{giftId}/archive`,
  security: bearerAuth,
  request: { params: eventAndGiftIdParamSchema },
  responses: {
    200: { description: "Gift archived", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Gift pools (admin: balloon/round settings) ----

registry.registerPath({
  method: "get",
  tags: ["Gift Pools"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pools`,
  security: bearerAuth,
  request: { params: eventIdParamSchema },
  responses: {
    200: { description: "List gift pools", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Gift Pools"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pools`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, body: jsonBody(createPoolSchema) },
  responses: {
    201: { description: "Gift pool created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Gift Pools"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pools/{poolId}`,
  security: bearerAuth,
  request: { params: eventAndPoolIdParamSchema, body: jsonBody(updatePoolSchema) },
  responses: {
    200: { description: "Gift pool updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Gift pool entries (admin: per-pool gift visibility/odds/stock-config) ----

registry.registerPath({
  method: "get",
  tags: ["Gift Pool Entries"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pools/{poolId}/entries`,
  security: bearerAuth,
  request: { params: eventAndPoolIdParamSchema },
  responses: {
    200: { description: "List gift pool entries", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Gift Pool Entries"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pools/{poolId}/entries`,
  security: bearerAuth,
  request: { params: eventAndPoolIdParamSchema, body: jsonBody(createGiftPoolEntrySchema) },
  responses: {
    201: { description: "Gift pool entry created", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Gift Pool Entries"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pools/{poolId}/entries/{entryId}`,
  security: bearerAuth,
  request: { params: poolAndEntryIdParamSchema, body: jsonBody(updateGiftPoolEntrySchema) },
  responses: {
    200: { description: "Gift pool entry updated", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Gift Pool Entries"],
  path: `${ADMIN_BASE}/events/{eventId}/gift-pool-entries/{entryId}/stock`,
  security: bearerAuth,
  request: { params: eventAndEntryIdParamSchema, body: jsonBody(adjustStockSchema) },
  responses: {
    200: { description: "Stock adjusted", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "get",
  tags: ["Gift Pool Entries"],
  path: `${ADMIN_BASE}/events/{eventId}/stock-adjustments`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, query: listStockAdjustmentsQuerySchema },
  responses: {
    200: { description: "Stock adjustment audit log", content: { "application/json": { schema: successEnvelope(z.array(z.unknown())) } } },
    ...errorResponses,
  },
});

// ---- Wins (admin) ----

registry.registerPath({
  method: "get",
  tags: ["Wins"],
  path: `${ADMIN_BASE}/events/{eventId}/wins`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, query: adminListWinsQuerySchema },
  responses: {
    200: { description: "List winning records", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "patch",
  tags: ["Wins"],
  path: `${ADMIN_BASE}/events/{eventId}/wins/{winId}/claim`,
  security: bearerAuth,
  request: { params: eventAndWinIdParamSchema },
  responses: {
    200: { description: "Win marked as claimed", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Stats (admin) ----

registry.registerPath({
  method: "get",
  tags: ["Stats"],
  path: `${ADMIN_BASE}/events/{eventId}/stats`,
  security: bearerAuth,
  request: { params: eventIdParamSchema },
  responses: {
    200: { description: "Accepted-win and remaining-stock stats", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

// ---- Public (frontend) ----

registry.registerPath({
  method: "get",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/events/{eventId}/game-config`,
  request: { params: eventIdParamSchema, query: gameConfigQuerySchema },
  responses: {
    200: { description: "Game configuration for the frontend to run a round locally", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/events/{eventId}/participants`,
  request: { params: eventIdParamSchema, body: jsonBody(registerParticipantSchema) },
  responses: {
    201: { description: "Participant registered", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    200: { description: "Already registered (idempotent replay)", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});

registry.registerPath({
  method: "post",
  tags: ["Public"],
  path: `${PUBLIC_BASE}/events/{eventId}/wins`,
  security: bearerAuth,
  request: { params: eventIdParamSchema, body: jsonBody(recordWinSchema) },
  responses: {
    201: { description: "Win recorded", content: { "application/json": { schema: successEnvelope(z.unknown()) } } },
    ...errorResponses,
  },
});
