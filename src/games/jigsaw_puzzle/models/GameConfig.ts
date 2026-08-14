import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export type DifficultyMode = "fixed" | "player_choice";
export type RegistrationFieldType = "text" | "email" | "phone" | "number" | "select";
export type PuzzleSource = "camera" | "uploaded_image";
export type PlayerMode = "guest" | "registered";

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
  // The backend never stores/serves the actual image - "uploaded_image"
  // events just carry a label the frontend's own bundled assets already
  // know how to resolve. See puzzleImageKey below.
  puzzleSource: PuzzleSource;
  // Only meaningful when puzzleSource is "uploaded_image" - null otherwise.
  puzzleImageKey: string | null;
  playerMode: PlayerMode;
  timerEnabled: boolean;
  hintsEnabled: boolean;
  // Stored even when hintsEnabled is false; simply unused in that case -
  // keeps the type a plain number instead of number | undefined.
  maxHints: number;
  leaderboardEnabled: boolean;
  showScore: boolean;
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
    puzzleSource: { type: String, required: true, enum: ["camera", "uploaded_image"] },
    puzzleImageKey: { type: String, default: null, trim: true },
    playerMode: { type: String, required: true, enum: ["guest", "registered"] },
    timerEnabled: { type: Boolean, required: true },
    hintsEnabled: { type: Boolean, required: true },
    maxHints: { type: Number, required: true, default: 0, min: 0 },
    leaderboardEnabled: { type: Boolean, required: true },
    showScore: { type: Boolean, required: true },
  },
  { timestamps: true }
);

export const GameConfig = model<GameConfigDocument>(
  "JigsawPuzzleGameConfig",
  gameConfigSchema,
  "jigsaw_puzzle_game_configs"
);
