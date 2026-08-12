import { Server, Socket } from "socket.io";
import { MIN_RESUME_REMAINING_MS, QUESTION_DURATION_MS } from "../config/constants";
import { logger } from "../logger/logger";
import * as gameService from "../services/game.service";
import {
  AckCallback,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket.types";
import { GameStatePayload } from "../types/game.types";
import { AppError } from "../utils/AppError";
import {
  endGameSchema,
  joinSchema,
  judgeAnswerSchema,
  pauseGameSchema,
  redirectDisplaySchema,
  resumeGameSchema,
  restartGameSchema,
  retryPuzzleSchema,
  revealAnswerSchema,
  shuffleOrderSchema,
  skipPuzzleSchema,
  startGameSchema,
} from "../validators/game.validator";
import * as presence from "./presence.manager";
import * as timerManager from "./timer.manager";

type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const roomName = (gameCode: string): string => `game:${gameCode}`;

const broadcastState = (io: AppServer, state: GameStatePayload): void => {
  io.to(roomName(state.gameCode)).emit("game:state", state);
};

const scheduleQuestionTimeout = (
  io: AppServer,
  gameCode: string,
  questionEndsAt: string | null
): void => {
  if (!questionEndsAt) {
    return;
  }
  const remaining = new Date(questionEndsAt).getTime() - Date.now();

  timerManager.schedule(gameCode, Math.max(remaining, 0), () => {
    void gameService.timeoutQuestion(gameCode).then((state) => {
      broadcastState(io, state);
    });
  });
};

const assertFacilitator = (socket: AppSocket, gameCode: string): void => {
  if (socket.data.role !== "facilitator" || socket.data.gameCode !== gameCode) {
    throw new AppError("Only the facilitator can perform this action", 403);
  }
};

const ok = (callback: AckCallback | undefined, data: GameStatePayload): void => {
  callback?.({ success: true, data });
};

const fail = (callback: AckCallback | undefined, message: string): void => {
  callback?.({ success: false, message });
};

const extractErrorMessage = (err: unknown): string => {
  if (err instanceof AppError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unexpected error";
};

const withErrorHandling = (
  callback: AckCallback | undefined,
  fn: () => Promise<void>
): void => {
  void fn().catch((err: unknown) => {
    if (!(err instanceof AppError)) {
      logger.error({ err }, "Unhandled socket error");
    }
    fail(callback, extractErrorMessage(err));
  });
};

export const registerGameHandlers = (io: AppServer, socket: AppSocket): void => {
  socket.on("game:join", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode, role } = joinSchema.parse(payload);

      await gameService.getGame(gameCode);

      await socket.join(roomName(gameCode));
      socket.data.gameCode = gameCode;
      socket.data.role = role;
      presence.addConnection(gameCode, role, socket.id);

      const state = await gameService.setConnectionStatus(gameCode, role, true);
      logger.info(
        { gameCode, role, socketId: socket.id },
        role === "facilitator" ? "Facilitator connected" : "Display connected"
      );

      ok(callback, state);
      broadcastState(io, state);
    })
  );

  socket.on("game:start", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = startGameSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      const state = await gameService.startGame(gameCode);
      ok(callback, state);
      broadcastState(io, state);
      scheduleQuestionTimeout(io, gameCode, state.questionEndsAt);
    })
  );

  socket.on("game:judge", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode, result } = judgeAnswerSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      timerManager.clear(gameCode);
      const state = await gameService.judgeAnswer(gameCode, result);
      ok(callback, state);
      broadcastState(io, state);
    })
  );

  socket.on("game:reveal", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = revealAnswerSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      timerManager.clear(gameCode);
      const state = await gameService.revealAnswer(gameCode);
      ok(callback, state);
      broadcastState(io, state);
    })
  );

  socket.on("game:shuffle", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = shuffleOrderSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      const state = await gameService.shuffleOrder(gameCode);
      ok(callback, state);
      broadcastState(io, state);
    })
  );

  socket.on("game:pause", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = pauseGameSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      timerManager.clear(gameCode);
      const state = await gameService.pauseGame(gameCode);
      ok(callback, state);
      broadcastState(io, state);
    })
  );

  socket.on("game:resume", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = resumeGameSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      const current = await gameService.getGame(gameCode);
      const rawRemaining = current.questionEndsAt
        ? new Date(current.questionEndsAt).getTime() - Date.now()
        : QUESTION_DURATION_MS;
      const remainingMs = Math.max(rawRemaining, MIN_RESUME_REMAINING_MS);

      const state = await gameService.resumeGame(gameCode, remainingMs);
      ok(callback, state);
      broadcastState(io, state);
      scheduleQuestionTimeout(io, gameCode, state.questionEndsAt);
    })
  );

  socket.on("game:skip", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = skipPuzzleSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      timerManager.clear(gameCode);
      const state = await gameService.skipPuzzle(gameCode);
      ok(callback, state);
      broadcastState(io, state);
      if (state.status === "playing") {
        scheduleQuestionTimeout(io, gameCode, state.questionEndsAt);
      }
    })
  );

  socket.on("game:retry", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = retryPuzzleSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      timerManager.clear(gameCode);
      const state = await gameService.retryPuzzle(gameCode);
      ok(callback, state);
      broadcastState(io, state);
      scheduleQuestionTimeout(io, gameCode, state.questionEndsAt);
    })
  );

  // Pure broadcast: no game state is read or written for either code, it
  // just tells whatever display is sitting in the OLD game's room to
  // navigate itself to the NEW one - the display never needs to be touched.
  socket.on("game:redirect-display", (payload, callback) => {
    void (async () => {
      try {
        const { gameCode, newGameCode } = redirectDisplaySchema.parse(payload);
        assertFacilitator(socket, gameCode);
        await gameService.getGame(newGameCode);

        io.to(roomName(gameCode)).emit("display:redirect", { newGameCode });
        callback?.({ success: true });
      } catch (err) {
        if (!(err instanceof AppError)) {
          logger.error({ err }, "Unhandled socket error");
        }
        callback?.({ success: false, message: extractErrorMessage(err) });
      }
    })();
  });

  socket.on("game:restart", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = restartGameSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      timerManager.clear(gameCode);
      const state = await gameService.restartGame(gameCode);
      ok(callback, state);
      broadcastState(io, state);
    })
  );

  socket.on("game:end", (payload, callback) =>
    withErrorHandling(callback, async () => {
      const { gameCode } = endGameSchema.parse(payload);
      assertFacilitator(socket, gameCode);

      timerManager.clear(gameCode);
      const state = await gameService.finishGame(gameCode);
      ok(callback, state);
      broadcastState(io, state);
    })
  );

  socket.on("disconnect", () => {
    void (async () => {
      const { gameCode, role } = socket.data;
      if (!gameCode || !role) {
        return;
      }

      const isLastOfRole = presence.removeConnection(gameCode, role, socket.id);
      if (!isLastOfRole) {
        return;
      }

      try {
        let state = await gameService.setConnectionStatus(gameCode, role, false);
        logger.info(
          { gameCode, role },
          role === "facilitator" ? "Facilitator disconnected" : "Display disconnected"
        );

        if (role === "facilitator" && state.status === "playing") {
          timerManager.clear(gameCode);
          state = await gameService.pauseGame(gameCode);
          logger.warn({ gameCode }, "Facilitator disconnected mid-game, auto-pausing");
        }

        broadcastState(io, state);
      } catch (err) {
        logger.error({ err, gameCode }, "Error handling socket disconnect");
      }
    })();
  });
};
