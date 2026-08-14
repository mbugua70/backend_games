import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

export const jigsawPuzzleOpenApiDocument = new OpenApiGeneratorV3(
  registry.definitions
).generateDocument({
  openapi: "3.0.0",
  info: {
    title: "jigsaw_puzzle API",
    version: "1.0.0",
    description:
      "Admin (bearer-token) and public game-client REST endpoints for the jigsaw_puzzle backend. " +
      "Generated directly from the Zod validators in src/games/jigsaw_puzzle/validators/, so request " +
      "shapes here can never drift from what the API actually accepts.",
  },
});
