import { Types } from "mongoose";
import { AppError } from "../../../core/utils/AppError";
import { EventDocument } from "../models/Event";
import { GiftPool, GiftPoolDocument, GiftPoolMessages } from "../models/GiftPool";
import { assertEventOwnedByOrg, bumpConfigVersion } from "./eventAccess";
import { broadcastPoolUpdate } from "../sockets/broadcast";

export type GiftPoolResolution =
  | { available: true; pool: GiftPoolDocument }
  | { available: false; reason: string };

// Resolves which GiftPool a (event, brand) combination should play against,
// given Event.giftPoolMode. In "shared" mode every brand plays the event's
// single brandId:null pool; in "perBrand" mode each brand needs its own
// pool, and a brand that hasn't been configured yet gets an explicit
// unavailable result rather than a 500 or a silently empty config.
export const resolveGiftPool = async (
  event: EventDocument,
  brandId: string | null
): Promise<GiftPoolResolution> => {
  if (event.giftPoolMode === "shared") {
    const pool = await GiftPool.findOne({ eventId: event._id, brandId: null });
    if (!pool) {
      return { available: false, reason: "No shared gift pool has been configured for this event yet" };
    }
    return { available: true, pool };
  }

  if (!brandId) {
    return { available: false, reason: "Select a brand to see its gift pool" };
  }

  const pool = await GiftPool.findOne({ eventId: event._id, brandId });
  if (!pool) {
    return { available: false, reason: "No gift pool has been configured for this brand yet" };
  }
  return { available: true, pool };
};

// Admin-side: fetch-or-require a pool by id, scoped to the event, used by
// every gift-pool-entry/stock-adjustment/balloon-settings admin route.
export const getPoolOrThrow = async (
  eventId: string,
  poolId: string
): Promise<GiftPoolDocument> => {
  if (!Types.ObjectId.isValid(poolId)) {
    throw new AppError("Gift pool not found", 404);
  }
  const pool = await GiftPool.findOne({ _id: poolId, eventId });
  if (!pool) {
    throw new AppError("Gift pool not found", 404);
  }
  return pool;
};

export interface BalloonSettings {
  balloonCount: number;
  guaranteedNoGiftBalloonCount: number;
  maxPopsPerRound: number;
  maxWinsPerRound: number;
}

// Pure so it's directly unit-testable without a database: balloonCount must
// be positive; guaranteedNoGiftBalloonCount sits between zero and
// balloonCount; maxPopsPerRound between one and balloonCount; maxWinsPerRound
// between zero and maxPopsPerRound.
export const validateBalloonSettings = (settings: BalloonSettings): void => {
  if (!Number.isInteger(settings.balloonCount) || settings.balloonCount <= 0) {
    throw new AppError("balloonCount must be a positive integer", 400);
  }
  if (
    !Number.isInteger(settings.guaranteedNoGiftBalloonCount) ||
    settings.guaranteedNoGiftBalloonCount < 0 ||
    settings.guaranteedNoGiftBalloonCount > settings.balloonCount
  ) {
    throw new AppError(
      "guaranteedNoGiftBalloonCount must be between 0 and balloonCount",
      400
    );
  }
  if (
    !Number.isInteger(settings.maxPopsPerRound) ||
    settings.maxPopsPerRound < 1 ||
    settings.maxPopsPerRound > settings.balloonCount
  ) {
    throw new AppError("maxPopsPerRound must be between 1 and balloonCount", 400);
  }
  if (
    !Number.isInteger(settings.maxWinsPerRound) ||
    settings.maxWinsPerRound < 0 ||
    settings.maxWinsPerRound > settings.maxPopsPerRound
  ) {
    throw new AppError("maxWinsPerRound must be between 0 and maxPopsPerRound", 400);
  }
};

export interface GiftPoolAdminPayload extends BalloonSettings {
  id: string;
  brandId: string | null;
  messages: GiftPoolMessages;
}

const toGiftPoolAdminPayload = (pool: GiftPoolDocument): GiftPoolAdminPayload => ({
  id: pool._id.toString(),
  brandId: pool.brandId ? pool.brandId.toString() : null,
  balloonCount: pool.balloonCount,
  guaranteedNoGiftBalloonCount: pool.guaranteedNoGiftBalloonCount,
  maxPopsPerRound: pool.maxPopsPerRound,
  maxWinsPerRound: pool.maxWinsPerRound,
  messages: pool.messages,
});

export const listPools = async (
  organizationId: string,
  eventId: string
): Promise<GiftPoolAdminPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const pools = await GiftPool.find({ eventId }).sort({ createdAt: 1 });
  return pools.map(toGiftPoolAdminPayload);
};

export interface GiftPoolInput extends BalloonSettings {
  brandId?: string | null;
  messages?: Partial<GiftPoolMessages>;
}

export const createPool = async (
  organizationId: string,
  eventId: string,
  input: GiftPoolInput
): Promise<GiftPoolAdminPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  validateBalloonSettings(input);
  const pool = await GiftPool.create({ eventId, ...input, brandId: input.brandId ?? null });
  await bumpConfigVersion(eventId);
  return toGiftPoolAdminPayload(pool);
};

export const updatePool = async (
  organizationId: string,
  eventId: string,
  poolId: string,
  input: Partial<BalloonSettings> & { messages?: Partial<GiftPoolMessages> }
): Promise<GiftPoolAdminPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const pool = await getPoolOrThrow(eventId, poolId);

  const merged: BalloonSettings = {
    balloonCount: input.balloonCount ?? pool.balloonCount,
    guaranteedNoGiftBalloonCount: input.guaranteedNoGiftBalloonCount ?? pool.guaranteedNoGiftBalloonCount,
    maxPopsPerRound: input.maxPopsPerRound ?? pool.maxPopsPerRound,
    maxWinsPerRound: input.maxWinsPerRound ?? pool.maxWinsPerRound,
  };
  validateBalloonSettings(merged);

  pool.set({
    ...merged,
    messages: input.messages ? { ...pool.messages, ...input.messages } : pool.messages,
  });
  await pool.save();
  await bumpConfigVersion(eventId);
  await broadcastPoolUpdate(pool._id.toString());
  return toGiftPoolAdminPayload(pool);
};
