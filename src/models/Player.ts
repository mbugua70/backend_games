import { Document, Schema, model } from "mongoose";

export interface PlayerDocument extends Document {
  staffId: string;
  name: string;
  // Set the moment login succeeds, not when a score is submitted - this
  // closes the loophole of abandoning a bad game before it reaches
  // /api/scores/submit and just logging in again for a fresh attempt.
  hasPlayed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<PlayerDocument>(
  {
    staffId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    hasPlayed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Player = model<PlayerDocument>("Player", playerSchema, "players");
