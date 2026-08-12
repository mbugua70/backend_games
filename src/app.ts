import cors from "cors";
import express, { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./logger/logger";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import adminRoutes from "./routes/admin.routes";
import gameRoutes from "./routes/game.routes";
import playerRoutes from "./routes/player.routes";
import reportRoutes from "./routes/report.routes";
import scoreRoutes from "./routes/score.routes";
import tugwarRoutes from "./routes/tugwar.routes";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300;

export const createApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URLS,
      // Content-Disposition isn't in the CORS-safelisted response headers,
      // so without this the admin dashboard's fetch() can read the CSV body
      // fine but reports/export's filename silently falls back to a default
      // - see report.controller.ts's exportCsv.
      exposedHeaders: ["Content-Disposition"],
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

  app.use("/api/game-sessions", gameRoutes);

  // Self-service Rubus Puzzle kiosk game (online_rubuspuzzle) - no
  // facilitator, no socket sync, unrelated to the game-sessions routes above.
  app.use("/api/players", playerRoutes);
  app.use("/api/scores", scoreRoutes);

  // Admin reporting dashboard for online_rubuspuzzle (see online_rubuspuzzle's
  // /admin route) - bearer-token auth, no cookies, since the dashboard and
  // this API are on different domains. /api/admin/reports/* is gated by
  // requireAdmin inside report.routes.ts itself.
  app.use("/api/admin/auth", adminRoutes);
  app.use("/api/admin/reports", reportRoutes);

  // Tug of War (tug_war) - two-player match registration and results.
  // Unrelated to every other game mounted above; unlimited replays, no
  // facilitator/display split, no admin dashboard (yet).
  app.use("/api/tugwar/matches", tugwarRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
