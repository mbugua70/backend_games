import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

export type GameType = "CARREFOUR_BALLOON";
export type GiftPoolMode = "shared" | "perBrand";
export type EventStatus = "draft" | "live" | "paused" | "ended";

export interface EventDocument extends Document {
  name: string;
  code: string;
  organizationId: Types.ObjectId;
  // Literal label only - this repo's convention is one fully separate
  // src/games/<name>/ folder per game (see root CLAUDE.md), not a shared
  // polymorphic table keyed by game type.
  gameType: GameType;
  status: EventStatus;
  // Admins can flip shared/perBrand without this ever touching GiftPool
  // documents - both kinds persist side by side regardless of which mode
  // is active (see models/GiftPool.ts).
  giftPoolMode: GiftPoolMode;
  // Single source of truth for "is registration on" - RegistrationConfig
  // only holds the field shape, not this toggle, so there's never a case
  // where the two disagree on whether registration is required.
  registrationEnabled: boolean;
  // Incremented whenever Brand/GiftPool/Gift/GiftPoolEntry/
  // RegistrationConfig change for this event - lets a client (REST or
  // socket) detect it needs to re-sync its local config copy.
  configVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<EventDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    gameType: {
      type: String,
      required: true,
      enum: ["CARREFOUR_BALLOON"],
      default: "CARREFOUR_BALLOON",
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "live", "paused", "ended"],
      default: "draft",
    },
    giftPoolMode: { type: String, required: true, enum: ["shared", "perBrand"], default: "shared" },
    registrationEnabled: { type: Boolean, required: true, default: false },
    configVersion: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export const Event = model<EventDocument>(
  "CarrefourBalloonEvent",
  eventSchema,
  "carrefour_balloon_events"
);
