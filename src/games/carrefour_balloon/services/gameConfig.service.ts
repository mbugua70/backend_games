import { AppError } from "../../../core/utils/AppError";
import { Brand, BrandDocument } from "../models/Brand";
import { Event } from "../models/Event";
import { RegistrationConfig } from "../models/RegistrationConfig";
import { resolveGiftPool } from "./giftPool.service";
import { buildPoolSnapshot } from "./poolSnapshot.service";

export interface GameConfigBrandSummary {
  id: string;
  name: string;
  logoUrl: string;
}

export interface GameConfigGiftSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  availableQuantity: number;
  configuredProbabilityPercent: number;
  effectiveProbabilityPercent: number;
  eligible: boolean;
}

export interface GameConfigRegistrationField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface GameConfigPayload {
  event: {
    id: string;
    name: string;
    status: string;
    available: boolean;
  };
  brands: GameConfigBrandSummary[];
  selectedBrand: GameConfigBrandSummary | null;
  giftPoolMode: "shared" | "perBrand";
  giftPoolId: string | null;
  configVersion: number;
  serverTime: string;
  balloonSettings: {
    balloonCount: number;
    guaranteedNoGiftBalloonCount: number;
    maxPopsPerRound: number;
    maxWinsPerRound: number;
  } | null;
  gifts: GameConfigGiftSummary[];
  effectiveNoGiftProbabilityPercent: number | null;
  registration: {
    enabled: boolean;
    fields: GameConfigRegistrationField[];
    consentText: string | null;
  };
  messages: { win: string | null; lose: string | null; unavailable: string | null } | null;
  unavailableReason: string | null;
}

const toBrandSummary = (brand: BrandDocument): GameConfigBrandSummary => ({
  id: brand._id.toString(),
  name: brand.name,
  logoUrl: brand.logoUrl,
});

// The single mapper behind GET /game-config, the socket game:join ack, and
// the admin config-preview route - reused as-is by all three so none of
// them can ever drift on what "the config" looks like (same principle as
// jigsaw_puzzle's toGameStatePayload per root CLAUDE.md).
export const getGameConfig = async (
  eventId: string,
  brandId: string | null
): Promise<GameConfigPayload> => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const brands = await Brand.find({ eventId: event._id, enabled: true }).sort({ displayOrder: 1 });
  const registrationConfig = await RegistrationConfig.findOne({ eventId: event._id });

  const registration = {
    enabled: event.registrationEnabled,
    fields: registrationConfig?.fields ?? [],
    consentText: registrationConfig?.consentText ?? null,
  };

  const eventAvailableForPlay = event.status === "live";
  const base = {
    event: {
      id: event._id.toString(),
      name: event.name,
      status: event.status,
      available: eventAvailableForPlay,
    },
    brands: brands.map(toBrandSummary),
    giftPoolMode: event.giftPoolMode,
    configVersion: event.configVersion,
    serverTime: new Date().toISOString(),
    registration,
  };

  if (!brandId) {
    // Selection screen: no gift/balloon detail until a brand is chosen.
    return {
      ...base,
      selectedBrand: null,
      giftPoolId: null,
      balloonSettings: null,
      gifts: [],
      effectiveNoGiftProbabilityPercent: null,
      messages: null,
      unavailableReason: eventAvailableForPlay ? null : "Event is not currently active",
    };
  }

  const selectedBrand = brands.find((b) => b._id.toString() === brandId) ?? null;
  if (!selectedBrand) {
    return {
      ...base,
      selectedBrand: null,
      giftPoolId: null,
      balloonSettings: null,
      gifts: [],
      effectiveNoGiftProbabilityPercent: null,
      messages: null,
      unavailableReason: "This brand is not part of the event",
    };
  }

  if (!eventAvailableForPlay) {
    return {
      ...base,
      selectedBrand: toBrandSummary(selectedBrand),
      giftPoolId: null,
      balloonSettings: null,
      gifts: [],
      effectiveNoGiftProbabilityPercent: null,
      messages: null,
      unavailableReason: "Event is not currently active",
    };
  }

  const resolution = await resolveGiftPool(event, brandId);
  if (!resolution.available) {
    return {
      ...base,
      selectedBrand: toBrandSummary(selectedBrand),
      giftPoolId: null,
      balloonSettings: null,
      gifts: [],
      effectiveNoGiftProbabilityPercent: null,
      messages: null,
      unavailableReason: resolution.reason,
    };
  }

  const { pool } = resolution;
  const snapshot = await buildPoolSnapshot(pool);

  return {
    ...base,
    selectedBrand: toBrandSummary(selectedBrand),
    giftPoolId: snapshot.giftPoolId,
    balloonSettings: snapshot.balloonSettings,
    gifts: snapshot.gifts,
    effectiveNoGiftProbabilityPercent: snapshot.effectiveNoGiftProbabilityPercent,
    messages: snapshot.messages,
    unavailableReason: null,
  };
};
