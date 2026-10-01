import { Document, Schema, Types, model } from "mongoose";
import "./Event";

// Reusable gift details only - pool-specific quantity/probability/
// visibility live on GiftPoolEntry instead, so the same gift (e.g. "Tote
// Bag") can be configured differently per pool without duplicating its
// name/description/image.
export interface GiftDocument extends Document {
  eventId: Types.ObjectId;
  name: string;
  description: string | null;
  imageUrl: string | null;
  // Soft delete - archiving (not removing) a gift preserves history on any
  // WinningRecord that already snapshot its name/image.
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const giftSchema = new Schema<GiftDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonEvent", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    imageUrl: { type: String, default: null, trim: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

giftSchema.index({ eventId: 1, archivedAt: 1 });

export const Gift = model<GiftDocument>(
  "CarrefourBalloonGift",
  giftSchema,
  "carrefour_balloon_gifts"
);
