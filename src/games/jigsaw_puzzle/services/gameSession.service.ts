import { AppError } from "../../../core/utils/AppError";
import { Event } from "../models/Event";
import { DifficultyTier, GameConfig, GameConfigDocument } from "../models/GameConfig";
import {
  DifficultySnapshot,
  GameSession,
  GameSessionDocument,
  GameSessionStatus,
} from "../models/GameSession";
import { Player } from "../models/Player";
import { assertEventOwnedByOrg } from "./eventAccess";
import { assertEventIsLive } from "./event.service";
import { calculateScore } from "./scoring.service";

export interface GameSessionPayload {
  id: string;
  uuid: string;
  eventId: string;
  playerId: string | null;
  difficulty: DifficultySnapshot;
  status: GameSessionStatus;
  moves: number;
  hintsUsed: number;
  score: number | null;
  durationSeconds: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const toGameSessionPayload = (session: GameSessionDocument): GameSessionPayload => ({
  id: session._id.toString(),
  uuid: session.uuid,
  eventId: session.eventId.toString(),
  playerId: session.playerId ? session.playerId.toString() : null,
  difficulty: {
    key: session.difficulty.key,
    label: session.difficulty.label,
    pieceCount: session.difficulty.pieceCount,
    timeLimitSeconds: session.difficulty.timeLimitSeconds,
  },
  status: session.status,
  moves: session.moves,
  hintsUsed: session.hintsUsed,
  score: session.score,
  durationSeconds: session.durationSeconds,
  completedAt: session.completedAt,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

// "fixed" mode always uses defaultDifficultyKey and ignores whatever the
// client sent - a "player_choice" event requires a valid key. Either way,
// this is the only place a difficulty tier gets picked, so a frontend can
// never talk a fixed event into a different tier than the admin configured.
const resolveDifficulty = (
  config: GameConfigDocument,
  requestedDifficultyKey?: string
): DifficultyTier => {
  const key =
    config.difficultyMode === "player_choice" ? requestedDifficultyKey : config.defaultDifficultyKey;

  if (!key) {
    throw new AppError("difficultyKey is required for this event", 400);
  }

  const tier = config.difficultyTiers.find((candidate) => candidate.key === key);
  if (!tier) {
    throw new AppError(`Unknown difficulty "${key}"`, 400);
  }
  return tier;
};

// Public - starts a session for this event. eventCode is the public lookup
// key; playerId (when sent) is scoped to that same event so one event's
// player can't start a session on another.
//
// "registered" mode requires a real, already-registered playerId, same as
// before. "guest" mode makes it optional - the resulting session's playerId
// is null unless one was sent anyway (a guest event doesn't forbid
// registration, it just doesn't require it). Which mode applies is read
// from GameConfig, never trusted from the client.
export const startSession = async (
  eventCode: string,
  playerId: string | undefined,
  requestedDifficultyKey?: string
): Promise<GameSessionPayload> => {
  const event = await Event.findOne({ code: eventCode });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  assertEventIsLive(event);

  const config = await GameConfig.findOne({ eventId: event._id });
  if (!config) {
    throw new AppError("Game config not found for this event", 404);
  }

  if (config.playerMode === "registered" && !playerId) {
    throw new AppError("playerId is required for this event", 400);
  }

  let player = null;
  if (playerId) {
    player = await Player.findOne({ _id: playerId, eventId: event._id });
    if (!player) {
      throw new AppError("Player not found for this event", 404);
    }
  }

  const tier = resolveDifficulty(config, requestedDifficultyKey);

  const session = await GameSession.create({
    eventId: event._id,
    playerId: player ? player._id : null,
    difficulty: {
      key: tier.key,
      label: tier.label,
      pieceCount: tier.pieceCount,
      timeLimitSeconds: tier.timeLimitSeconds,
    },
  });

  return toGameSessionPayload(session);
};

// Public - the client submits final totals (moves, hintsUsed) once, rather
// than incrementing them over a live connection; durationSeconds and score
// are both computed server-side so neither can be spoofed by the client.
// Deliberately doesn't re-check assertEventIsLive: a session already started
// before the event ended should still be allowed to finish, not get stranded
// mid-play by the clock running out underneath it.
export const completeSession = async (
  sessionUuid: string,
  moves: number,
  hintsUsed: number
): Promise<GameSessionPayload> => {
  const session = await GameSession.findOne({ uuid: sessionUuid });
  if (!session) {
    throw new AppError("Game session not found", 404);
  }
  if (session.status === "completed") {
    throw new AppError("This session has already been completed", 409);
  }

  const config = await GameConfig.findOne({ eventId: session.eventId });
  if (config?.hintsEnabled && hintsUsed > config.maxHints) {
    throw new AppError(`hintsUsed cannot exceed maxHints (${config.maxHints})`, 400);
  }

  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - session.createdAt.getTime()) / 1000)
  );
  const score = calculateScore({
    pieceCount: session.difficulty.pieceCount,
    durationSeconds,
    moves,
    hintsUsed,
  });

  session.moves = moves;
  session.hintsUsed = hintsUsed;
  session.durationSeconds = durationSeconds;
  session.score = score;
  session.status = "completed";
  session.completedAt = new Date();
  await session.save();

  return toGameSessionPayload(session);
};

export const listSessionsByEvent = async (
  organizationId: string,
  eventId: string
): Promise<GameSessionPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const sessions = await GameSession.find({ eventId }).sort({ createdAt: -1 });
  return sessions.map(toGameSessionPayload);
};

export const getSessionById = async (
  organizationId: string,
  eventId: string,
  sessionId: string
): Promise<GameSessionPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const session = await GameSession.findOne({ _id: sessionId, eventId });
  if (!session) {
    throw new AppError("Game session not found", 404);
  }
  return toGameSessionPayload(session);
};
