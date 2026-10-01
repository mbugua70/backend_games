import { Document, Schema, Types, model } from "mongoose";
import "./GiftPoolEntry";
import "./Admin";

// Append-only audit log - never updated or deleted after creation, one row
// per admin stock +/- action (see services/stockAdjustment.service.ts).
export interface StockAdjustmentDocument extends Document {
  giftPoolEntryId: Types.ObjectId;
  adminId: Types.ObjectId;
  amount: number;
  reason: string;
  previousQuantity: number;
  newQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const stockAdjustmentSchema = new Schema<StockAdjustmentDocument>(
  {
    giftPoolEntryId: {
      type: Schema.Types.ObjectId,
      ref: "CarrefourBalloonGiftPoolEntry",
      required: true,
    },
    adminId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonAdmin", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

stockAdjustmentSchema.index({ giftPoolEntryId: 1, createdAt: -1 });

export const StockAdjustment = model<StockAdjustmentDocument>(
  "CarrefourBalloonStockAdjustment",
  stockAdjustmentSchema,
  "carrefour_balloon_stock_adjustments"
);
