import { Document, Schema, Types, model } from "mongoose";
import { TUGWAR_PILLARS, TUGWAR_SIDES, TugWarPillar, TugWarSide } from "../types/tugwar.types";

export interface TugWarPlayerDocument extends Document {
  name: string;
  pillar: TugWarPillar;
  side: TugWarSide;
  matchId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tugWarPlayerSchema = new Schema<TugWarPlayerDocument>(
  {
    name: { type: String, required: true, trim: true },
    pillar: { type: String, enum: TUGWAR_PILLARS, required: true },
    side: { type: String, enum: TUGWAR_SIDES, required: true },
    matchId: { type: Schema.Types.ObjectId, ref: "TugWarMatch", required: true },
  },
  { timestamps: true }
);

// No unique index on name/pillar - unlimited replays are intentional, each
// registration is its own row (see tugwar.service.ts's startMatch).
export const TugWarPlayer = model<TugWarPlayerDocument>(
  "TugWarPlayer",
  tugWarPlayerSchema,
  "tugwar_players"
);
