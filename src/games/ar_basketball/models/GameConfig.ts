import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export interface GameConfigDocument extends Document {
  eventId: Types.ObjectId;
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
  leaderboardEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gameConfigSchema = new Schema<GameConfigDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "ArBasketballEvent", required: true, unique: true },
    durationSeconds: { type: Number, required: true, min: 1 },
    normalBasketPoints: { type: Number, required: true, min: 0 },
    swishEnabled: { type: Boolean, required: true, default: true },
    swishPoints: { type: Number, required: true, min: 0 },
    longRangeEnabled: { type: Boolean, required: true, default: true },
    longRangeDistanceMeters: { type: Number, required: true, min: 0 },
    longRangePoints: { type: Number, required: true, min: 0 },
    streakEnabled: { type: Boolean, required: true, default: true },
    // Consecutive makes needed to trigger the streak bonus - 2 is the
    // practical floor (a "streak" of 1 is just a normal basket).
    streakRequired: { type: Number, required: true, min: 2 },
    streakBonusPoints: { type: Number, required: true, min: 0 },
    leaderboardEnabled: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const GameConfig = model<GameConfigDocument>(
  "ArBasketballGameConfig",
  gameConfigSchema,
  "ar_basketball_game_configs"
);
