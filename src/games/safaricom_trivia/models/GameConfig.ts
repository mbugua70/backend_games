import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

// Defaults match what the original trivia frontend hardcoded, so an org
// that never touches its config plays exactly the game it used to.
export const DEFAULT_GAME_CONFIG = {
  questionsPerGame: 10,
  questionTimeLimitMs: 13_000,
  totalTimeLimitMs: 160_000,
  answerColors: ["#00a651", "#0072bc", "#f7941d", "#ed1c24"],
} as const;

export interface GameConfigDocument extends Document {
  organizationId: Types.ObjectId;
  questionsPerGame: number;
  questionTimeLimitMs: number;
  // Shown as the overall countdown on the scoreboard. Also the basis for
  // flagging a late submission - see services/session.service.ts.
  totalTimeLimitMs: number;
  // Background colour per answer button, by position. Replaces the old
  // backend's separate colors collection.
  answerColors: string[];
  createdAt: Date;
  updatedAt: Date;
}

const gameConfigSchema = new Schema<GameConfigDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    questionsPerGame: {
      type: Number,
      required: true,
      min: 1,
      default: DEFAULT_GAME_CONFIG.questionsPerGame,
    },
    questionTimeLimitMs: {
      type: Number,
      required: true,
      min: 1000,
      default: DEFAULT_GAME_CONFIG.questionTimeLimitMs,
    },
    totalTimeLimitMs: {
      type: Number,
      required: true,
      min: 1000,
      default: DEFAULT_GAME_CONFIG.totalTimeLimitMs,
    },
    answerColors: {
      type: [String],
      required: true,
      default: () => [...DEFAULT_GAME_CONFIG.answerColors],
    },
  },
  { timestamps: true }
);

export const GameConfig = model<GameConfigDocument>(
  "SafaricomTriviaGameConfig",
  gameConfigSchema,
  "safaricom_trivia_game_configs"
);
