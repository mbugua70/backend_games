import {
  RegistrationConfig,
  RegistrationConfigDocument,
  RegistrationField,
} from "../models/RegistrationConfig";
import { assertEventOwnedByOrg, bumpConfigVersion } from "./eventAccess";

export interface RegistrationConfigPayload {
  fields: RegistrationField[];
  consentText: string | null;
}

const toPayload = (config: RegistrationConfigDocument | null): RegistrationConfigPayload => ({
  fields: config?.fields ?? [],
  consentText: config?.consentText ?? null,
});

export const getRegistrationConfig = async (
  organizationId: string,
  eventId: string
): Promise<RegistrationConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const config = await RegistrationConfig.findOne({ eventId });
  return toPayload(config);
};

export interface UpdateRegistrationConfigInput {
  fields: RegistrationField[];
  consentText?: string | null;
}

export const upsertRegistrationConfig = async (
  organizationId: string,
  eventId: string,
  input: UpdateRegistrationConfigInput
): Promise<RegistrationConfigPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const config = await RegistrationConfig.findOneAndUpdate(
    { eventId },
    { $set: { fields: input.fields, consentText: input.consentText ?? null } },
    { upsert: true, new: true }
  );
  await bumpConfigVersion(eventId);
  return toPayload(config);
};
