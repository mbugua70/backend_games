import cors from "cors";
import express, { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./core/config/env";
import { logger } from "./core/logger/logger";
import { errorHandler } from "./core/middleware/errorHandler";
import { notFound } from "./core/middleware/notFound";
import { jigsawPuzzleOpenApiDocument } from "./games/jigsaw_puzzle/openapi/document";
import jigsawPuzzleAdminAuthRoutes from "./games/jigsaw_puzzle/routes/admin/auth.routes";
import jigsawPuzzleAdminEventRoutes from "./games/jigsaw_puzzle/routes/admin/event.routes";
import jigsawPuzzleAdminEventStatsRoutes from "./games/jigsaw_puzzle/routes/admin/eventStats.routes";
import jigsawPuzzleAdminGameConfigRoutes from "./games/jigsaw_puzzle/routes/admin/gameConfig.routes";
import jigsawPuzzleAdminGameSessionRoutes from "./games/jigsaw_puzzle/routes/admin/gameSession.routes";
import jigsawPuzzleAdminLeaderboardRoutes from "./games/jigsaw_puzzle/routes/admin/leaderboard.routes";
import jigsawPuzzleAdminPlayerRoutes from "./games/jigsaw_puzzle/routes/admin/player.routes";
import jigsawPuzzleGameRoutes from "./games/jigsaw_puzzle/routes/game/game.routes";
import { arBasketballOpenApiDocument } from "./games/ar_basketball/openapi/document";
import arBasketballAdminAuthRoutes from "./games/ar_basketball/routes/admin/auth.routes";
import arBasketballAdminEventRoutes from "./games/ar_basketball/routes/admin/event.routes";
import arBasketballAdminEventBrandingRoutes from "./games/ar_basketball/routes/admin/eventBranding.routes";
import arBasketballAdminEventStatsRoutes from "./games/ar_basketball/routes/admin/eventStats.routes";
import arBasketballAdminGameConfigRoutes from "./games/ar_basketball/routes/admin/gameConfig.routes";
import arBasketballAdminGameSessionRoutes from "./games/ar_basketball/routes/admin/gameSession.routes";
import arBasketballAdminLeaderboardRoutes from "./games/ar_basketball/routes/admin/leaderboard.routes";
import arBasketballAdminLeaderboardConfigRoutes from "./games/ar_basketball/routes/admin/leaderboardConfig.routes";
import arBasketballAdminPlayerRoutes from "./games/ar_basketball/routes/admin/player.routes";
import arBasketballAdminRegistrationConfigRoutes from "./games/ar_basketball/routes/admin/registrationConfig.routes";
import arBasketballGameRoutes from "./games/ar_basketball/routes/game/game.routes";
import feedbackRoutes from "./games/feedback/routes/feedback.routes";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300;

export const createApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URLS,
    })
  );
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use(
    "/api",
    rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      limit: RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          message: "Too many requests, please try again later",
        });
      },
    })
  );

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Endpoints for jigsaw_puzzle game

  app.use("/api/admin/jigsaw_puzzle/auth", jigsawPuzzleAdminAuthRoutes);
  // Mounted before /events so a /:eventId/config request is matched here
  // directly, rather than falling through the /events router's non-matching
  // routes first.
  app.use(
    "/api/admin/jigsaw_puzzle/events/:eventId/config",
    jigsawPuzzleAdminGameConfigRoutes
  );
  app.use(
    "/api/admin/jigsaw_puzzle/events/:eventId/players",
    jigsawPuzzleAdminPlayerRoutes
  );
  app.use(
    "/api/admin/jigsaw_puzzle/events/:eventId/sessions",
    jigsawPuzzleAdminGameSessionRoutes
  );
  app.use(
    "/api/admin/jigsaw_puzzle/events/:eventId/leaderboard",
    jigsawPuzzleAdminLeaderboardRoutes
  );
  app.use(
    "/api/admin/jigsaw_puzzle/events/:eventId/stats",
    jigsawPuzzleAdminEventStatsRoutes
  );
  app.use("/api/admin/jigsaw_puzzle/events", jigsawPuzzleAdminEventRoutes);

  app.use("/api/jigsaw_puzzle", jigsawPuzzleGameRoutes);

  // Endpoints for ar_basketball game

  app.use("/api/admin/ar_basketball/v1/auth", arBasketballAdminAuthRoutes);
  // Mounted before /events so a /:eventId/... request is matched here
  // directly, rather than falling through the /events router's
  // non-matching routes first.
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/branding",
    arBasketballAdminEventBrandingRoutes
  );
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/registration-config",
    arBasketballAdminRegistrationConfigRoutes
  );
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/game-config",
    arBasketballAdminGameConfigRoutes
  );
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/leaderboard-config",
    arBasketballAdminLeaderboardConfigRoutes
  );
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/players",
    arBasketballAdminPlayerRoutes
  );
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/sessions",
    arBasketballAdminGameSessionRoutes
  );
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/leaderboard",
    arBasketballAdminLeaderboardRoutes
  );
  app.use(
    "/api/admin/ar_basketball/v1/events/:eventId/stats",
    arBasketballAdminEventStatsRoutes
  );
  app.use("/api/admin/ar_basketball/v1/events", arBasketballAdminEventRoutes);

  app.use("/api/ar_basketball/v1", arBasketballGameRoutes);

  // Not a game - customer feedback for the website, gated by a static
  // x-api-key header rather than admin JWT auth (see CLAUDE.md).
  app.use("/api/feedback", feedbackRoutes);

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(jigsawPuzzleOpenApiDocument));
  // Separate path from jigsaw_puzzle's /api/docs mount above - each game
  // gets its own generated OpenAPI document rather than a merged one.
  app.use(
    "/api/docs/ar_basketball",
    swaggerUi.serveFiles(arBasketballOpenApiDocument),
    swaggerUi.setup(arBasketballOpenApiDocument)
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
