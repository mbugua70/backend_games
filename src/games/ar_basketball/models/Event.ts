import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

export type GameType = "AR_BASKETBALL";

export interface EventDocument extends Document {
  name: string;
  code: string;
  organizationId: Types.ObjectId;
  // Literal label only - this repo's convention is one fully separate
  // src/games/<name>/ folder per game (see root CLAUDE.md), not a shared
  // polymorphic table keyed by game type. A future game gets its own
  // folder, not a new value slotted in here.
  gameType: GameType;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  // Incremented whenever scoring/duration (GameConfig), registration
  // (RegistrationConfig), or leaderboard (LeaderboardConfig) settings
  // change - lets a client detect it needs to re-download config.
  configVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<EventDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    gameType: { type: String, required: true, enum: ["AR_BASKETBALL"], default: "AR_BASKETBALL" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    configVersion: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export const Event = model<EventDocument>(
  "ArBasketballEvent",
  eventSchema,
  "ar_basketball_events"
);
