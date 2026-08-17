import { AppError } from "../../../core/utils/AppError";
import {
  PlayerMode,
  RegistrationConfig,
  RegistrationConfigDocument,
  RegistrationField,
} from "../models/RegistrationConfig";
import { assertEventOwnedByOrg } from "./eventAccess";
import { bumpConfigVersion } from "./event.service";

interface RegistrationConfigInput {
  playerMode: PlayerMode;
  fields: RegistrationField[];
  phoneFieldKey?: string | null;
  nameFieldKey?: string | null;
}

export interface RegistrationConfigPayload {
  id: string;
  eventId: string;
  playerMode: PlayerMode;
  fields: RegistrationField[];
  phoneFieldKey: string | null;
  nameFieldKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toRegistrationConfigPayload = (
  config: RegistrationConfigDocument
): RegistrationConfigPayload => ({
  id: config._id.toString(),
  eventId: config.eventId.toString(),
  playerMode: config.playerMode,
  fields: config.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    ...(field.options && { options: field.options }),
  })),
  phoneFieldKey: config.phoneFieldKey,
  nameFieldKey: config.nameFieldKey,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt,
});

// phoneFieldKey/nameFieldKey (when set) must reference an actual fields[]
// entry - phoneFieldKey specifically a "phone"-typed one, since that's the
// field the leaderboard masks. A dangling/mistyped key would otherwise
// silently break masking/display instead of failing fast at config-save time.
const assertValidFieldKeys = (
  fields: RegistrationField[],
  phoneFieldKey: string | null | undefined,
  nameFieldKey: string | null | undefined
): void => {
  if (phoneFieldKey) {
    const field = fields.find((candidate) => candidate.key === phoneFieldKey);
    if (!field || field.type !== "phone") {
      throw new AppError('phoneFieldKey must reference a field of type "phone"', 400);
    }
  }
  if (nameFieldKey && !fields.some((field) => field.key === nameFieldKey)) {
    throw new AppError("nameFieldKey must reference a known registration field", 400);
  }
};

export const createRegistrationConfig = async (
  organizationId: string,
  eventId: string,
  input: RegistrationConfigInput
): Promise<RegistrationConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  assertValidFieldKeys(input.fields, input.phoneFieldKey, input.nameFieldKey);

  const existing = await RegistrationConfig.findOne({ eventId });
  if (existing) {
    throw new AppError("This event already has a registration config", 409);
  }

  const config = await RegistrationConfig.create({ eventId, ...input });
  return toRegistrationConfigPayload(config);
};

// Shared by the admin endpoint (org-scoped, below) and the public
// registration/session flow, which needs the field list and phone/name
// keys but has no organizationId to scope by.
export const getRegistrationConfigByEventId = async (
  eventId: string
): Promise<RegistrationConfigPayload> => {
  const config = await RegistrationConfig.findOne({ eventId });
  if (!config) {
    throw new AppError("Registration config not found for this event", 404);
  }
  return toRegistrationConfigPayload(config);
};

export const getRegistrationConfigByEvent = async (
  organizationId: string,
  eventId: string
): Promise<RegistrationConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  return getRegistrationConfigByEventId(eventId);
};

export const updateRegistrationConfig = async (
  organizationId: string,
  eventId: string,
  input: RegistrationConfigInput
): Promise<RegistrationConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  assertValidFieldKeys(input.fields, input.phoneFieldKey, input.nameFieldKey);

  const config = await RegistrationConfig.findOneAndUpdate({ eventId }, input, { new: true });
  if (!config) {
    throw new AppError("Registration config not found for this event", 404);
  }
  await bumpConfigVersion(eventId);
  return toRegistrationConfigPayload(config);
};
