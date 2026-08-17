import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

export const arBasketballOpenApiDocument = new OpenApiGeneratorV3(
  registry.definitions
).generateDocument({
  openapi: "3.0.0",
  info: {
    title: "ar_basketball API",
    version: "1.0.0",
    description:
      "Admin (bearer-token) and public mobile-client REST endpoints for the ar_basketball backend. " +
      "Generated directly from the Zod validators in src/games/ar_basketball/validators/, so request " +
      "shapes here can never drift from what the API actually accepts.",
  },
});
