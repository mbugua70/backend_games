import cors from "cors";
import express, { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./core/config/env";
import { logger } from "./core/logger/logger";
import { errorHandler } from "./core/middleware/errorHandler";
import { notFound } from "./core/middleware/notFound";
import jigsawPuzzleAdminAuthRoutes from "./games/jigsaw_puzzle/routes/admin/auth.routes";
import jigsawPuzzleAdminEventRoutes from "./games/jigsaw_puzzle/routes/admin/event.routes";

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

  app.use("/api/admin/jigsaw_puzzle/auth", jigsawPuzzleAdminAuthRoutes);
  app.use("/api/admin/jigsaw_puzzle/events", jigsawPuzzleAdminEventRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
