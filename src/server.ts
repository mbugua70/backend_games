import "./core/utils/cryptoPolyfill";
import http from "http";
import { Server as SocketIoServer } from "socket.io";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./core/config/database";
import { env } from "./core/config/env";
import { logger } from "./core/logger/logger";
import { initCarrefourBalloonSockets } from "./games/carrefour_balloon/sockets";

const app = createApp();
const server = http.createServer(app);

// One shared Socket.IO instance for the whole process - each game that
// needs live sync registers its own handlers onto it from inside its own
// sockets/ folder (see root CLAUDE.md). Only carrefour_balloon uses this
// today.
const io = new SocketIoServer(server, { cors: { origin: env.CLIENT_URLS } });
initCarrefourBalloonSockets(io);

const start = async (): Promise<void> => {
  await connectDatabase();

  server.listen(env.PORT, () => {
    logger.info(`Server started on port ${env.PORT} (${env.NODE_ENV})`);
  });
};

const shutdown = (signal: string): void => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    void disconnectDatabase().finally(() => process.exit(0));
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err: unknown) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
