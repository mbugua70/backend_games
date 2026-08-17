import { Document, Schema, Types, model } from "mongoose";
import "./Event";
import "./Player";

export type GameSessionStatus = "in_progress" | "completed";
export type ShotResult = "made" | "missed";

// Snapshotted from GameConfig at session-start time, not referenced live -
// so a later admin edit to the event's scoring rules never changes the
// rules a past (or in-flight) session was actually played/scored under.
export interface GameConfigSnapshot {
  durationSeconds: number;
  normalBasketPoints: number;
  swishEnabled: boolean;
  swishPoints: number;
  longRangeEnabled: boolean;
  longRangeDistanceMeters: number;
  longRangePoints: number;
  streakEnabled: boolean;
  streakRequired: number;
  streakBonusPoints: number;
}

// Snapshotted from the registered Player at session-start time - the
// leaderboard/analytics read path never needs to join back to Player.
// maskedPhone is pre-masked so the raw number is never stored here;
// displayName is resolved from RegistrationConfig.nameFieldKey, since
// registration fields are admin-defined and can't be assumed to have a
// fixed "name" key.
export interface PlayerSnapshot {
  registrationData: Record<string, string>;
  displayName: string | null;
  maskedPhone: string | null;
}

export interface Shot {
  // Optional here because plain (not-yet-saved) shot objects assigned to
  // this array don't have one yet - Mongoose generates it on save, same as
  // any other subdocument _id.
  _id?: Types.ObjectId;
  result: ShotResult;
  touchedRim: boolean;
  touchedBackboard: boolean;
  distanceMeters: number;
  // Server-computed from the session's configSnapshot - never trusted from
  // the client's submission.
  isSwish: boolean;
  isLongRange: boolean;
  streakAtShot: number;
  pointsAwarded: number;
  shotAt: Date | null;
}

export interface GameSessionDocument extends Document {
  // Client-generated (unlike jigsaw_puzzle's server-default uuid) - the
  // tablet must be able to safely retry "start session" with the same
  // value after a dropped response, per the offline-safe design
  // requirement.
  sessionUuid: string;
  eventId: Types.ObjectId;
  playerId: Types.ObjectId | null;
  playerSnapshot: PlayerSnapshot | null;
  configSnapshot: GameConfigSnapshot;
  status: GameSessionStatus;
  shots: Shot[];
  // Raw client-submitted score, kept only for audit/mismatch review -
  // never the authoritative value.
  submittedScore: number | null;
  score: number | null;
  // Stored (not derived from completedAt - createdAt on read) so the
  // leaderboard's fastest-time tie-break can be a plain indexed sort
  // instead of an aggregation on every query.
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

const gameConfigSnapshotSchema = new Schema<GameConfigSnapshot>(
  {
    durationSeconds: { type: Number, required: true },
    normalBasketPoints: { type: Number, required: true },
    swishEnabled: { type: Boolean, required: true },
    swishPoints: { type: Number, required: true },
    longRangeEnabled: { type: Boolean, required: true },
    longRangeDistanceMeters: { type: Number, required: true },
    longRangePoints: { type: Number, required: true },
    streakEnabled: { type: Boolean, required: true },
    streakRequired: { type: Number, required: true },
    streakBonusPoints: { type: Number, required: true },
  },
  { _id: false }
);

const playerSnapshotSchema = new Schema<PlayerSnapshot>(
  {
    registrationData: { type: Schema.Types.Mixed, required: true, default: {} },
    displayName: { type: String, default: null },
    maskedPhone: { type: String, default: null },
  },
  { _id: false }
);

// Deliberately keeps its default _id - each shot behaves like an entity
// per the spec, even though it's embedded rather than a top-level
// collection (see gameSession.service.ts for why: shots are always
// written together with session completion, and embedding sidesteps
// needing a Mongoose transaction this codebase has no existing pattern for).
const shotSchema = new Schema<Shot>({
  result: { type: String, required: true, enum: ["made", "missed"] },
  touchedRim: { type: Boolean, required: true },
  touchedBackboard: { type: Boolean, required: true },
  distanceMeters: { type: Number, required: true, min: 0 },
  isSwish: { type: Boolean, required: true, default: false },
  isLongRange: { type: Boolean, required: true, default: false },
  streakAtShot: { type: Number, required: true, default: 0, min: 0 },
  pointsAwarded: { type: Number, required: true, default: 0, min: 0 },
  shotAt: { type: Date, default: null },
});

const gameSessionSchema = new Schema<GameSessionDocument>(
  {
    sessionUuid: { type: String, required: true, unique: true, trim: true },
    eventId: { type: Schema.Types.ObjectId, ref: "ArBasketballEvent", required: true },
    // Nullable: a session can start in guest mode, without a player.
    playerId: { type: Schema.Types.ObjectId, ref: "ArBasketballPlayer", default: null },
    playerSnapshot: { type: playerSnapshotSchema, default: null },
    configSnapshot: { type: gameConfigSnapshotSchema, required: true },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      required: true,
      default: "in_progress",
    },
    shots: { type: [shotSchema], required: true, default: [] },
    submittedScore: { type: Number, default: null, min: 0 },
    score: { type: Number, default: null, min: 0 },
    durationSeconds: { type: Number, default: null, min: 0 },
    totalShots: { type: Number, required: true, default: 0, min: 0 },
    totalBaskets: { type: Number, required: true, default: 0, min: 0 },
    totalMisses: { type: Number, required: true, default: 0, min: 0 },
    totalSwishes: { type: Number, required: true, default: 0, min: 0 },
    totalLongRangeBaskets: { type: Number, required: true, default: 0, min: 0 },
    totalLongRangeAttempts: { type: Number, required: true, default: 0, min: 0 },
    bestStreak: { type: Number, required: true, default: 0, min: 0 },
    accuracy: { type: Number, default: null, min: 0, max: 1 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

gameSessionSchema.index({ eventId: 1, createdAt: -1 });
// Base leaderboard shape: completed sessions for an event, highest score
// first. The two indexes below add the second-level tie-break each
// rankingStrategy needs.
gameSessionSchema.index({ eventId: 1, status: 1, score: -1 });
gameSessionSchema.index({ eventId: 1, status: 1, score: -1, durationSeconds: 1 });
gameSessionSchema.index({ eventId: 1, status: 1, score: -1, accuracy: -1 });

export const GameSession = model<GameSessionDocument>(
  "ArBasketballGameSession",
  gameSessionSchema,
  "ar_basketball_game_sessions"
);
