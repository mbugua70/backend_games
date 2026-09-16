import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

export const safaricomCeoOpenApiDocument = new OpenApiGeneratorV3(
  registry.definitions
).generateDocument({
  openapi: "3.0.0",
  info: {
    title: "safaricom_ceo API",
    version: "1.0.0",
    description:
      "Admin (bearer-token) and public participant-facing REST endpoints for the safaricom_ceo " +
      "60-Second CEO Challenge backend. Generated directly from the Zod validators in " +
      "src/games/safaricom_ceo/validators/, so request shapes here can never drift from what the " +
      "API actually accepts. Final profile-selection business rules are not yet approved by the " +
      "client - see services/profileResolver.service.ts - so `profile` on the result endpoint is " +
      "null until that lands.",
  },
});
