import { GameStatePayload, Role } from "./game.types";

export type AckResponse =
  | { success: true; data: GameStatePayload }
  | { success: false; message: string };

export type AckCallback = (response: AckResponse) => void;

export type SimpleAckResponse = { success: true } | { success: false; message: string };

export type SimpleAckCallback = (response: SimpleAckResponse) => void;

export interface JoinPayload {
  gameCode: string;
  role: Role;
}

export interface GameCodePayload {
  gameCode: string;
}

export interface JudgePayload {
  gameCode: string;
  result: "correct" | "wrong";
}

/**
 * gameCode is the OLD game the facilitator (and display) are currently in;
 * newGameCode is where the display should be redirected to. Purely a
 * broadcast signal - no game state is read or written for either code.
 */
export interface RedirectDisplayPayload {
  gameCode: string;
  newGameCode: string;
}

export interface ClientToServerEvents {
  "game:join": (payload: JoinPayload, callback?: AckCallback) => void;
  "game:start": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:judge": (payload: JudgePayload, callback?: AckCallback) => void;
  "game:reveal": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:shuffle": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:pause": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:resume": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:skip": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:retry": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:restart": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:end": (payload: GameCodePayload, callback?: AckCallback) => void;
  "game:redirect-display": (payload: RedirectDisplayPayload, callback?: SimpleAckCallback) => void;
}

export interface ServerToClientEvents {
  "game:state": (payload: GameStatePayload) => void;
  "display:redirect": (payload: { newGameCode: string }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export interface SocketData {
  gameCode: string | null;
  role: Role | null;
}
