import { AppError } from "../../../core/utils/AppError";
import { Event } from "../models/Event";
import {
  DifficultyTier,
  GameConfig,
  GameConfigDocument,
  RegistrationField,
} from "../models/GameConfig";

interface GameConfigInput {
  difficultyMode: "fixed" | "player_choice";
  difficultyTiers: DifficultyTier[];
  defaultDifficultyKey: string;
  registrationFields: RegistrationField[];
}

export interface GameConfigPayload {
  id: string;
  eventId: string;
  difficultyMode: "fixed" | "player_choice";
  difficultyTiers: DifficultyTier[];
  defaultDifficultyKey: string;
  registrationFields: RegistrationField[];
  createdAt: Date;
  updatedAt: Date;
}

const toGameConfigPayload = (config: GameConfigDocument): GameConfigPayload => ({
  id: config._id.toString(),
  eventId: config.eventId.toString(),
  difficultyMode: config.difficultyMode,
  difficultyTiers: config.difficultyTiers,
  defaultDifficultyKey: config.defaultDifficultyKey,
  registrationFields: config.registrationFields,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt,
});

// Confirms the event exists AND belongs to this admin's organization before
// any GameConfig read/write, the same isolation guarantee event.service
// enforces directly on its own queries.
const assertEventOwnedByOrg = async (organizationId: string, eventId: string): Promise<void> => {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
};

export const createGameConfig = async (
  organizationId: string,
  eventId: string,
  input: GameConfigInput
): Promise<GameConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const existing = await GameConfig.findOne({ eventId });
  if (existing) {
    throw new AppError("This event already has a game config", 409);
  }

  const config = await GameConfig.create({ eventId, ...input });
  return toGameConfigPayload(config);
};

export const getGameConfigByEvent = async (
  organizationId: string,
  eventId: string
): Promise<GameConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const config = await GameConfig.findOne({ eventId });
  if (!config) {
    throw new AppError("Game config not found for this event", 404);
  }
  return toGameConfigPayload(config);
};

export const updateGameConfig = async (
  organizationId: string,
  eventId: string,
  input: GameConfigInput
): Promise<GameConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const config = await GameConfig.findOneAndUpdate({ eventId }, input, { new: true });
  if (!config) {
    throw new AppError("Game config not found for this event", 404);
  }
  return toGameConfigPayload(config);
};
