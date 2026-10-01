import { Document, Schema, Types, model } from "mongoose";
import "./GiftPool";
import "./Gift";

// 100% expressed as integer basis points rather than a float percentage -
// avoids floating-point boundary issues when summing many gifts' shares of
// a pool (see services/probability.service.ts), per the spec's "use
// integer probability units internally" requirement.
export const PROBABILITY_UNITS_TOTAL = 10_000;

// The pool-specific configuration of one gift: how many are left, whether
// it's currently shown/awardable, and its share of this pool's draw.
// Deliberately separate from Gift (reusable name/description/image) so the
// same gift can have different stock/odds in different pools.
export interface GiftPoolEntryDocument extends Document {
  giftPoolId: Types.ObjectId;
  giftId: Types.ObjectId;
  visible: boolean;
  awardEnabled: boolean;
  availableQuantity: number;
  // Basis points out of PROBABILITY_UNITS_TOTAL.
  probabilityPercent: number;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const giftPoolEntrySchema = new Schema<GiftPoolEntryDocument>(
  {
    giftPoolId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonGiftPool", required: true },
    giftId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonGift", required: true },
    visible: { type: Boolean, required: true, default: true },
    awardEnabled: { type: Boolean, required: true, default: true },
    availableQuantity: { type: Number, required: true, min: 0, default: 0 },
    probabilityPercent: {
      type: Number,
      required: true,
      min: 0,
      max: PROBABILITY_UNITS_TOTAL,
      default: 0,
    },
    displayOrder: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

giftPoolEntrySchema.index({ giftPoolId: 1, giftId: 1 }, { unique: true });
giftPoolEntrySchema.index({ giftPoolId: 1, displayOrder: 1 });

export const GiftPoolEntry = model<GiftPoolEntryDocument>(
  "CarrefourBalloonGiftPoolEntry",
  giftPoolEntrySchema,
  "carrefour_balloon_gift_pool_entries"
);
