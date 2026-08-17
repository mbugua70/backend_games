import { AppError } from "../../../core/utils/AppError";
import { EventBranding, EventBrandingDocument } from "../models/EventBranding";
import { assertEventOwnedByOrg } from "./eventAccess";

interface EventBrandingInput {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundImageUrl?: string | null;
  sponsorLogoUrls?: string[];
}

export interface EventBrandingPayload {
  id: string;
  eventId: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  backgroundImageUrl: string | null;
  sponsorLogoUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

const toEventBrandingPayload = (branding: EventBrandingDocument): EventBrandingPayload => ({
  id: branding._id.toString(),
  eventId: branding.eventId.toString(),
  logoUrl: branding.logoUrl,
  primaryColor: branding.primaryColor,
  secondaryColor: branding.secondaryColor,
  backgroundImageUrl: branding.backgroundImageUrl,
  sponsorLogoUrls: branding.sponsorLogoUrls,
  createdAt: branding.createdAt,
  updatedAt: branding.updatedAt,
});

export const createBranding = async (
  organizationId: string,
  eventId: string,
  input: EventBrandingInput
): Promise<EventBrandingPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const existing = await EventBranding.findOne({ eventId });
  if (existing) {
    throw new AppError("This event already has branding", 409);
  }

  const branding = await EventBranding.create({ eventId, ...input });
  return toEventBrandingPayload(branding);
};

// Shared by the admin endpoint (org-scoped, below) and the public config
// bundle endpoint. Returns null rather than throwing when absent - unlike
// registration/game/leaderboard config, branding is cosmetic and optional;
// an event can be fully playable without it.
export const getBrandingByEventId = async (
  eventId: string
): Promise<EventBrandingPayload | null> => {
  const branding = await EventBranding.findOne({ eventId });
  return branding ? toEventBrandingPayload(branding) : null;
};

export const getBrandingByEvent = async (
  organizationId: string,
  eventId: string
): Promise<EventBrandingPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const branding = await EventBranding.findOne({ eventId });
  if (!branding) {
    throw new AppError("Branding not found for this event", 404);
  }
  return toEventBrandingPayload(branding);
};

// Deliberately does not bump Event.configVersion - see the comment on
// event.service's bumpConfigVersion.
export const updateBranding = async (
  organizationId: string,
  eventId: string,
  input: EventBrandingInput
): Promise<EventBrandingPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const branding = await EventBranding.findOneAndUpdate({ eventId }, input, { new: true });
  if (!branding) {
    throw new AppError("Branding not found for this event", 404);
  }
  return toEventBrandingPayload(branding);
};
