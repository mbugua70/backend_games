import { Server } from "socket.io";

// Services (win.service.ts, the admin gift/stock/pool services) need to
// broadcast a config update after a mutation, but they have no direct
// reference to the Socket.IO instance server.ts creates - it's registered
// here once at startup instead of threading `io` through every service
// function call. Returns null until registerCarrefourBalloonSockets() has
// run (e.g. in unit tests that never start a socket server), in which case
// broadcasts are a safe no-op (see broadcast.ts).
let io: Server | null = null;

export const setIo = (server: Server): void => {
  io = server;
};

export const getIo = (): Server | null => io;
