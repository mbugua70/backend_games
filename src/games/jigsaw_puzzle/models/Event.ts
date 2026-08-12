import { Document, Schema, model } from "mongoose";

export interface EventDocument extends Document {
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<EventDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Event = model<EventDocument>(
  "JigsawPuzzleEvent",
  eventSchema,
  "jigsaw_puzzle_events"
);
