import { logger } from "../../../core/logger/logger";
import { AppError } from "../../../core/utils/AppError";
import {
  GameConfigSnapshot,
  GameSession,
  GameSessionDocument,
  GameSessionStatus,
  PlayerSnapshot,
} from "../models/GameSession";
import { Event } from "../models/Event";
import { Player } from "../models/Player";
import { assertEventOwnedByOrg } from "./eventAccess";
import { assertEventIsLive } from "./event.service";
import { getGameConfigByEventId } from "./gameConfig.service";
import { getRegistrationConfigByEventId } from "./registrationConfig.service";
import { maskPhone } from "./formatting.service";
import { computeShots, RawShot } from "./scoring.service";

export interface ScoredShotPayload {
  id: string;
  result: "made" | "missed";
  touchedRim: boolean;
  touchedBackboard: boolean;
  distanceMeters: number;
  isSwish: boolean;
  isLongRange: boolean;
  streakAtShot: number;
  pointsAwarded: number;
  shotAt: Date | null;
}

export interface GameSessionPayload {
  id: string;
  sessionUuid: string;
  eventId: string;
  playerId: string | null;
  playerSnapshot: PlayerSnapshot | null;
  configSnapshot: GameConfigSnapshot;
  status: GameSessionStatus;
  shots: ScoredShotPayload[];
  submittedScore: number | null;
  score: number | null;
  durationSeconds: number | null;
  totalShots: number;
  totalBaskets: number;
  totalMisses: number;
  totalSwishes: number;
  totalLongRangeBaskets: number;
  totalLongRangeAttempts: number;
  bestStreak: number;
  accuracy: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Reconstructs every subdocument/array field as a plain literal - never
// assigns a raw Mongoose (sub)document straight into the DTO (a past
// jigsaw_puzzle bug: doing that leaks Mongoose's internal bookkeeping
// properties into what's supposed to be a plain-JSON payload).
const toGameSessionPayload = (session: GameSessionDocument): GameSessionPayload => ({
  id: session._id.toString(),
  sessionUuid: session.sessionUuid,
  eventId: session.eventId.toString(),
  playerId: session.playerId ? session.playerId.toString() : null,
  playerSnapshot: session.playerSnapshot
    ? {
        registrationData: session.playerSnapshot.registrationData,
        displayName: session.playerSnapshot.displayName,
        maskedPhone: session.playerSnapshot.maskedPhone,
      }
    : null,
  configSnapshot: {
    durationSeconds: session.configSnapshot.durationSeconds,
    normalBasketPoints: session.configSnapshot.normalBasketPoints,
    swishEnabled: session.configSnapshot.swishEnabled,
    swishPoints: session.configSnapshot.swishPoints,
    longRangeEnabled: session.configSnapshot.longRangeEnabled,
    longRangeDistanceMeters: session.configSnapshot.longRangeDistanceMeters,
    longRangePoints: session.configSnapshot.longRangePoints,
    streakEnabled: session.configSnapshot.streakEnabled,
    streakRequired: session.configSnapshot.streakRequired,
    streakBonusPoints: session.configSnapshot.streakBonusPoints,
  },
  status: session.status,
  shots: session.shots.map((shot) => ({
    id: (shot._id ?? "").toString(),
    result: shot.result,
    touchedRim: shot.touchedRim,
    touchedBackboard: shot.touchedBackboard,
    distanceMeters: shot.distanceMeters,
    isSwish: shot.isSwish,
    isLongRange: shot.isLongRange,
    streakAtShot: shot.streakAtShot,
    pointsAwarded: shot.pointsAwarded,
    shotAt: shot.shotAt,
  })),
  submittedScore: session.submittedScore,
  score: session.score,
  durationSeconds: session.durationSeconds,
  totalShots: session.totalShots,
  totalBaskets: session.totalBaskets,
  totalMisses: session.totalMisses,
  totalSwishes: session.totalSwishes,
  totalLongRangeBaskets: session.totalLongRangeBaskets,
  totalLongRangeAttempts: session.totalLongRangeAttempts,
  bestStreak: session.bestStreak,
  accuracy: session.accuracy,
  completedAt: session.completedAt,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

export interface StartSessionResult {
  session: GameSessionPayload;
  wasCreated: boolean;
}

// Public - starts a session for this event. eventCode is the public lookup
// key; sessionUuid is CLIENT-generated so the tablet can safely retry this
// call after a dropped response without creating a duplicate session - see
// the idempotency check below, keyed by (eventId, sessionUuid) rather than
// sessionUuid alone so a stale/reused uuid under a different event can
// never retrieve someone else's session.
export const startSession = async (
  eventCode: string,
  sessionUuid: string,
  playerId?: string
): Promise<StartSessionResult> => {
  const event = await Event.findOne({ code: eventCode });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  assertEventIsLive(event);

  const existing = await GameSession.findOne({ eventId: event._id, sessionUuid });
  if (existing) {
    return { session: toGameSessionPayload(existing), wasCreated: false };
  }

  const registrationConfig = await getRegistrationConfigByEventId(event._id.toString());
  const gameConfig = await getGameConfigByEventId(event._id.toString());

  if (registrationConfig.playerMode === "registered" && !playerId) {
    throw new AppError("playerId is required for this event", 400);
  }

  let playerSnapshot: PlayerSnapshot | null = null;
  let resolvedPlayerId: string | null = null;
  if (playerId) {
    const player = await Player.findOne({ _id: playerId, eventId: event._id });
    if (!player) {
      throw new AppError("Player not found for this event", 404);
    }
    resolvedPlayerId = player._id.toString();

    const phoneValue = registrationConfig.phoneFieldKey
      ? player.registrationData[registrationConfig.phoneFieldKey]
      : undefined;
    const nameValue = registrationConfig.nameFieldKey
      ? player.registrationData[registrationConfig.nameFieldKey]
      : undefined;

    playerSnapshot = {
      registrationData: player.registrationData,
      displayName: nameValue ?? null,
      maskedPhone: phoneValue ? maskPhone(phoneValue) : null,
    };
  }

  const configSnapshot: GameConfigSnapshot = {
    durationSeconds: gameConfig.durationSeconds,
    normalBasketPoints: gameConfig.normalBasketPoints,
    swishEnabled: gameConfig.swishEnabled,
    swishPoints: gameConfig.swishPoints,
    longRangeEnabled: gameConfig.longRangeEnabled,
    longRangeDistanceMeters: gameConfig.longRangeDistanceMeters,
    longRangePoints: gameConfig.longRangePoints,
    streakEnabled: gameConfig.streakEnabled,
    streakRequired: gameConfig.streakRequired,
    streakBonusPoints: gameConfig.streakBonusPoints,
  };

  const session = await GameSession.create({
    sessionUuid,
    eventId: event._id,
    playerId: resolvedPlayerId,
    playerSnapshot,
    configSnapshot,
  });

  return { session: toGameSessionPayload(session), wasCreated: true };
};

// Public - the client submits the full shot log once. Score, streaks, and
// every derived total are recomputed server-side from the session's
// SNAPSHOTTED config (never the event's live config, never the client's
// submitted score) - see scoring.service.computeShots. A dropped-response
// retry with the same sessionUuid returns the already-completed result
// unchanged rather than re-scoring or rejecting, per the spec's offline-
// safe/idempotent design requirement (a deliberate divergence from
// jigsaw_puzzle, which rejects double-completion).
export const completeSession = async (
  sessionUuid: string,
  shots: RawShot[],
  submittedScore?: number
): Promise<GameSessionPayload> => {
  const session = await GameSession.findOne({ sessionUuid });
  if (!session) {
    throw new AppError("Game session not found", 404);
  }
  if (session.status === "completed") {
    return toGameSessionPayload(session);
  }

  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - session.createdAt.getTime()) / 1000)
  );

  const result = computeShots(shots, session.configSnapshot);

  if (submittedScore !== undefined && submittedScore !== result.totalScore) {
    logger.warn(
      { sessionUuid, submittedScore, calculatedScore: result.totalScore },
      "Client-submitted score mismatch"
    );
  }

  session.shots.splice(0, session.shots.length, ...result.shots);
  session.submittedScore = submittedScore ?? null;
  session.score = result.totalScore;
  session.durationSeconds = durationSeconds;
  session.totalShots = shots.length;
  session.totalBaskets = result.totalBaskets;
  session.totalMisses = result.totalMisses;
  session.totalSwishes = result.totalSwishes;
  session.totalLongRangeBaskets = result.totalLongRangeBaskets;
  session.totalLongRangeAttempts = result.totalLongRangeAttempts;
  session.bestStreak = result.bestStreak;
  session.accuracy = result.accuracy;
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
