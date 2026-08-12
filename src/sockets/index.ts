import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { logger } from "../logger/logger";
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket.types";
import { registerGameHandlers } from "./game.socket";

export type AppIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export const initSocket = (httpServer: HttpServer): AppIO => {
  const io: AppIO = new Server(httpServer, {
    cors: { origin: env.CLIENT_URLS },
  });

  io.on("connection", (socket) => {
    socket.data.gameCode = null;
    socket.data.role = null;
    registerGameHandlers(io, socket);
  });

  logger.info("Socket.IO initialized");
  return io;
};
