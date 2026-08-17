import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export type RankingStrategy =
  | "highest_score"
  | "highest_score_then_fastest"
  | "highest_score_then_best_accuracy";

export interface LeaderboardConfigDocument extends Document {
  eventId: Types.ObjectId;
  rankingStrategy: RankingStrategy;
  displayLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const leaderboardConfigSchema = new Schema<LeaderboardConfigDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "ArBasketballEvent", required: true, unique: true },
    rankingStrategy: {
      type: String,
      required: true,
      enum: ["highest_score", "highest_score_then_fastest", "highest_score_then_best_accuracy"],
      default: "highest_score",
    },
    displayLimit: { type: Number, required: true, default: 10, min: 1, max: 100 },
  },
  { timestamps: true }
);

export const LeaderboardConfig = model<LeaderboardConfigDocument>(
  "ArBasketballLeaderboardConfig",
  leaderboardConfigSchema,
  "ar_basketball_leaderboard_configs"
);
