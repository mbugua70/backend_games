import { Document, Schema, Types, model } from "mongoose";
import "./Event";
import "./Brand";

export interface GiftPoolMessages {
  win: string | null;
  lose: string | null;
  unavailable: string | null;
}

// The balloon/round settings container. brandId: null is the event's single
// shared pool; a non-null brandId is that one brand's own pool in perBrand
// mode. Both kinds can exist for the same event at once regardless of
// Event.giftPoolMode - switching modes only changes which one gameConfig
// resolves to, never deletes or copies the other (see
// services/giftPool.service.ts).
export interface GiftPoolDocument extends Document {
  eventId: Types.ObjectId;
  brandId: Types.ObjectId | null;
  balloonCount: number;
  guaranteedNoGiftBalloonCount: number;
  maxPopsPerRound: number;
  maxWinsPerRound: number;
  messages: GiftPoolMessages;
  createdAt: Date;
  updatedAt: Date;
}

const messagesSchema = new Schema<GiftPoolMessages>(
  {
    win: { type: String, default: null, trim: true },
    lose: { type: String, default: null, trim: true },
    unavailable: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const giftPoolSchema = new Schema<GiftPoolDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonEvent", required: true },
    brandId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonBrand", default: null },
    balloonCount: { type: Number, required: true, min: 1 },
    guaranteedNoGiftBalloonCount: { type: Number, required: true, min: 0, default: 0 },
    maxPopsPerRound: { type: Number, required: true, min: 1 },
    maxWinsPerRound: { type: Number, required: true, min: 0, default: 0 },
    messages: { type: messagesSchema, required: true, default: () => ({}) },
  },
  { timestamps: true }
);

// At most one shared pool per event.
giftPoolSchema.index(
  { eventId: 1 },
  { unique: true, partialFilterExpression: { brandId: null } }
);
// At most one pool per (event, brand) in perBrand mode.
giftPoolSchema.index(
  { eventId: 1, brandId: 1 },
  { unique: true, partialFilterExpression: { brandId: { $type: "objectId" } } }
);

export const GiftPool = model<GiftPoolDocument>(
  "CarrefourBalloonGiftPool",
  giftPoolSchema,
  "carrefour_balloon_gift_pools"
);
