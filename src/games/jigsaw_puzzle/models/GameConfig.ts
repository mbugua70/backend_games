import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export type DifficultyMode = "fixed" | "player_choice";
export type RegistrationFieldType = "text" | "email" | "phone" | "number" | "select";

export interface DifficultyTier {
  key: string;
  label: string;
  pieceCount: number;
  timeLimitSeconds: number;
}

export interface RegistrationField {
  key: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
}

export interface GameConfigDocument extends Document {
  eventId: Types.ObjectId;
  difficultyMode: DifficultyMode;
  difficultyTiers: DifficultyTier[];
  defaultDifficultyKey: string;
  registrationFields: RegistrationField[];
  createdAt: Date;
  updatedAt: Date;
}

const difficultyTierSchema = new Schema<DifficultyTier>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    pieceCount: { type: Number, required: true, min: 1 },
    timeLimitSeconds: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const registrationFieldSchema = new Schema<RegistrationField>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["text", "email", "phone", "number", "select"],
    },
    required: { type: Boolean, required: true, default: false },
    options: { type: [String], default: undefined },
  },
  { _id: false }
);

const gameConfigSchema = new Schema<GameConfigDocument>(
  {
    // unique -> one config per event, enforced at the DB level too, not just
    // in the service layer's create check.
    eventId: { type: Schema.Types.ObjectId, ref: "JigsawPuzzleEvent", required: true, unique: true },
    difficultyMode: { type: String, required: true, enum: ["fixed", "player_choice"] },
    difficultyTiers: { type: [difficultyTierSchema], required: true },
    defaultDifficultyKey: { type: String, required: true, trim: true },
    registrationFields: { type: [registrationFieldSchema], required: true, default: [] },
  },
  { timestamps: true }
);

export const GameConfig = model<GameConfigDocument>(
  "JigsawPuzzleGameConfig",
  gameConfigSchema,
  "jigsaw_puzzle_game_configs"
);
