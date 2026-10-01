import { Server } from "socket.io";
import { registerCarrefourBalloonSockets } from "./game.socket";
import { setIo } from "./ioRegistry";

export const initCarrefourBalloonSockets = (io: Server): void => {
  setIo(io);
  registerCarrefourBalloonSockets(io);
};
