import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

// PII (phone) - never log full documents of this model, only the id.
export interface PlayerDocument extends Document {
  organizationId: Types.ObjectId;
  name: string;
  // Always stored normalized to 2547XXXXXXXX / 2541XXXXXXXX (see
  // services/phone.ts), so "0712..." and "+254712..." are the same player.
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<PlayerDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// One player per phone per org - the backstop for "each phone plays once"
// under concurrent registrations of the same number.
playerSchema.index({ organizationId: 1, phone: 1 }, { unique: true });
playerSchema.index({ organizationId: 1, createdAt: -1 });

export const Player = model<PlayerDocument>(
  "SafaricomTriviaPlayer",
  playerSchema,
  "safaricom_trivia_players"
);
