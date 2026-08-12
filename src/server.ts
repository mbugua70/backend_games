import "./utils/cryptoPolyfill";
import http from "http";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./logger/logger";
import { initSocket } from "./sockets";

const app = createApp();
const server = http.createServer(app);
const io = initSocket(server);

const start = async (): Promise<void> => {
  await connectDatabase();

  server.listen(env.PORT, () => {
    logger.info(`Server started on port ${env.PORT} (${env.NODE_ENV})`);
  });
};

const shutdown = (signal: string): void => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  io.close(() => {
    void disconnectDatabase().finally(() => process.exit(0));
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err: unknown) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
