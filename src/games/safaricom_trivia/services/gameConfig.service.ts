import { Types } from "mongoose";
import { GameConfig, GameConfigDocument } from "../models/GameConfig";
import { UpdateGameConfigInput } from "../validators/gameConfig.validator";
import { getPublicOrganization } from "./organization.service";

export interface GameConfigPayload {
  questionsPerGame: number;
  questionTimeLimitMs: number;
  totalTimeLimitMs: number;
  answerColors: string[];
}

export const toGameConfigPayload = (config: GameConfigDocument): GameConfigPayload => ({
  questionsPerGame: config.questionsPerGame,
  questionTimeLimitMs: config.questionTimeLimitMs,
  totalTimeLimitMs: config.totalTimeLimitMs,
  answerColors: [...config.answerColors],
});

// An org never has to create its config explicitly - the first read
// upserts one with the schema defaults (models/GameConfig.ts). Upsert
// rather than find-then-create so two concurrent first reads can't both
// insert; the unique index on organizationId backstops it.
export const getOrCreateGameConfig = async (
  organizationId: string | Types.ObjectId
): Promise<GameConfigDocument> => {
  const config = await GameConfig.findOneAndUpdate(
    { organizationId },
    { $setOnInsert: { organizationId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  return config;
};

export const getPublicGameConfig = async (): Promise<GameConfigPayload> => {
  const organization = await getPublicOrganization();
  return toGameConfigPayload(await getOrCreateGameConfig(organization._id));
};

export const getAdminGameConfig = async (organizationId: string): Promise<GameConfigPayload> =>
  toGameConfigPayload(await getOrCreateGameConfig(organizationId));

export const updateGameConfig = async (
  organizationId: string,
  input: UpdateGameConfigInput
): Promise<GameConfigPayload> => {
  await getOrCreateGameConfig(organizationId);
  const config = await GameConfig.findOneAndUpdate(
    { organizationId },
    { $set: input },
    { returnDocument: "after", runValidators: true }
  );
  // Can't be null: the upsert above guarantees the document exists, and
  // configs are never deleted.
  return toGameConfigPayload(config as GameConfigDocument);
};
