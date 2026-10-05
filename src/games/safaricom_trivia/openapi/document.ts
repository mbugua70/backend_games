import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

export const safaricomTriviaOpenApiDocument = new OpenApiGeneratorV3(
  registry.definitions
).generateDocument({
  openapi: "3.0.0",
  info: {
    title: "safaricom_trivia API",
    version: "1.0.0",
    description:
      "Public player endpoints and admin (bearer-token) endpoints for the Safaricom trivia quiz. " +
      "Generated from the Zod validators in src/games/safaricom_trivia/validators/.",
  },
});
