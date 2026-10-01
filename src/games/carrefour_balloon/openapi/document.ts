import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

export const carrefourBalloonOpenApiDocument = new OpenApiGeneratorV3(
  registry.definitions
).generateDocument({
  openapi: "3.0.0",
  info: {
    title: "carrefour_balloon API",
    version: "1.0.0",
    description:
      "Admin (bearer-token) and public participant-facing REST endpoints for the carrefour_balloon " +
      "brand-festival balloon game backend. Generated directly from the Zod validators in " +
      "src/games/carrefour_balloon/validators/, so request shapes here can never drift from what the " +
      "API actually accepts. The frontend (Next.js) runs the balloon pop/reveal logic locally against " +
      "GET .../game-config - this backend never computes a pop's outcome. A Socket.IO layer (not shown " +
      "here, since it isn't HTTP) additionally pushes live gift/stock updates to clients watching the " +
      "same gift pool; see root CLAUDE.md for its event shapes.",
  },
});
