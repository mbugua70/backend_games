import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export interface BrandDocument extends Document {
  eventId: Types.ObjectId;
  name: string;
  logoUrl: string;
  displayOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<BrandDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonEvent", required: true },
    name: { type: String, required: true, trim: true },
    logoUrl: { type: String, required: true, trim: true },
    displayOrder: { type: Number, required: true, min: 1 },
    enabled: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

brandSchema.index({ eventId: 1, displayOrder: 1 });

export const Brand = model<BrandDocument>(
  "CarrefourBalloonBrand",
  brandSchema,
  "carrefour_balloon_brands"
);
