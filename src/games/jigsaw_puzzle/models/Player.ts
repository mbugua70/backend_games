import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export interface PlayerDocument extends Document {
  eventId: Types.ObjectId;
  // Keyed by the GameConfig.registrationFields[].key active for this event
  // at registration time - shape is admin-defined per event, so it can't be
  // a fixed set of typed columns.
  registrationData: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<PlayerDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "JigsawPuzzleEvent", required: true },
    registrationData: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true }
);

playerSchema.index({ eventId: 1, createdAt: -1 });

export const Player = model<PlayerDocument>(
  "JigsawPuzzlePlayer",
  playerSchema,
  "jigsaw_puzzle_players"
);
