import crypto from "crypto";
import mongoose from "mongoose";
import { AppError } from "../../../core/utils/AppError";
import { logger } from "../../../core/logger/logger";
import { Brand } from "../models/Brand";
import { Event } from "../models/Event";
import { Gift } from "../models/Gift";
import { GiftPoolEntry } from "../models/GiftPoolEntry";
import { WinningRecord, WinningRecordDocument } from "../models/WinningRecord";
import { resolveGiftPool } from "./giftPool.service";
import { broadcastPoolUpdate } from "../sockets/broadcast";

export interface RecordWinInput {
  eventId: string;
  brandId: string;
  giftPoolId: string;
  giftId: string;
  roundId: string;
  balloonId: string;
  configVersion: number;
  idempotencyKey: string;
  participantId: string | null;
  anonymousIdentity: string | null;
}

export interface WinResultPayload {
  winId: string;
  claimReference: string;
  claimStatus: "pending" | "claimed";
  gift: { id: string; name: string; imageUrl: string | null };
  receivedAt: string;
}

const toWinResultPayload = (record: WinningRecordDocument): WinResultPayload => ({
  winId: record._id.toString(),
  claimReference: record.claimReference,
  claimStatus: record.claimStatus,
  gift: {
    id: record.giftId.toString(),
    name: record.giftNameSnapshot,
    imageUrl: record.giftImageUrlSnapshot,
  },
  receivedAt: record.receivedAt.toISOString(),
});

// Stable hash of the fields that define "the same submission" - lets a
// reused idempotency key with genuinely different data be rejected instead
// of silently returning a mismatched cached result.
const buildFingerprint = (input: RecordWinInput): string => {
  const normalized = {
    eventId: input.eventId,
    brandId: input.brandId,
    giftPoolId: input.giftPoolId,
    giftId: input.giftId,
    roundId: input.roundId,
    balloonId: input.balloonId,
    participantId: input.participantId,
    anonymousIdentity: input.anonymousIdentity,
  };
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

// Short, human-readable at a redemption desk - not globally unique on its
// own, so recordWin() retries generation on the rare collision (guarded by
// WinningRecord's unique index on claimReference).
const generateClaimReference = (): string =>
  `CB-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const isDuplicateKeyErrorOn = (err: unknown, field: string): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code?: unknown }).code === 11000 &&
  JSON.stringify((err as { keyPattern?: unknown }).keyPattern ?? {}).includes(field);

const MAX_CLAIM_REFERENCE_ATTEMPTS = 3;

// Records a win already determined by the frontend - never calculates or
// chooses the outcome itself. Atomically (via a MongoDB transaction):
// confirms the gift is still awardable with stock, decrements stock by
// one, and saves the winning record, so two simultaneous requests for the
// last unit of a gift can never both succeed. See root CLAUDE.md-style
// plan notes for why this repo uses a real transaction here specifically.
export const recordWin = async (input: RecordWinInput): Promise<WinResultPayload> => {
  const fingerprint = buildFingerprint(input);

  const existing = await WinningRecord.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new AppError("Idempotency key was already used with different request data", 409);
    }
    return toWinResultPayload(existing);
  }

  const event = await Event.findById(input.eventId);
  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const brand = await Brand.findOne({ _id: input.brandId, eventId: event._id, enabled: true });
  if (!brand) {
    throw new AppError("Brand not found for this event", 404);
  }

  const resolution = await resolveGiftPool(event, input.brandId);
  if (!resolution.available) {
    throw new AppError(resolution.reason, 409);
  }
  const { pool } = resolution;
  if (pool._id.toString() !== input.giftPoolId) {
    throw new AppError(
      "Submitted gift pool does not match the event's current gift pool configuration",
      409
    );
  }

  const entry = await GiftPoolEntry.findOne({ giftPoolId: pool._id, giftId: input.giftId });
  if (!entry) {
    throw new AppError("This gift is not part of the resolved gift pool", 404);
  }

  const gift = await Gift.findOne({ _id: input.giftId, eventId: event._id, archivedAt: null });
  if (!gift) {
    throw new AppError("This gift is no longer available", 404);
  }

  const duplicateBalloon = await WinningRecord.findOne({
    eventId: event._id,
    brandId: brand._id,
    roundId: input.roundId,
    balloonId: input.balloonId,
  });
  if (duplicateBalloon) {
    throw new AppError("A win has already been recorded for this balloon", 409);
  }

  if (event.registrationEnabled && !input.participantId) {
    throw new AppError("A participant token is required for this event", 401);
  }
  if (!event.registrationEnabled && !input.anonymousIdentity) {
    throw new AppError("An anonymous round identity is required when registration is disabled", 400);
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_CLAIM_REFERENCE_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let created: WinningRecordDocument | null = null;

      await session.withTransaction(async () => {
        const decremented = await GiftPoolEntry.findOneAndUpdate(
          {
            _id: entry._id,
            visible: true,
            awardEnabled: true,
            availableQuantity: { $gt: 0 },
          },
          { $inc: { availableQuantity: -1 } },
          { session, new: true }
        );
        if (!decremented) {
          throw new AppError("This gift is no longer available", 409);
        }

        const [record] = await WinningRecord.create(
          [
            {
              eventId: event._id,
              brandId: brand._id,
              giftPoolId: pool._id,
              giftPoolEntryId: entry._id,
              giftId: gift._id,
              giftNameSnapshot: gift.name,
              giftImageUrlSnapshot: gift.imageUrl,
              configVersion: input.configVersion,
              roundId: input.roundId,
              balloonId: input.balloonId,
              participantId: input.participantId,
              anonymousIdentity: input.anonymousIdentity,
              idempotencyKey: input.idempotencyKey,
              requestFingerprint: fingerprint,
              claimReference: generateClaimReference(),
              claimStatus: "pending",
              receivedAt: new Date(),
            },
          ],
          { session }
        );
        created = record ?? null;
      });

      if (!created) {
        throw new AppError("Failed to record win", 500);
      }

      await broadcastPoolUpdate(pool._id.toString());
      return toWinResultPayload(created);
    } catch (err) {
      lastError = err;
      if (isDuplicateKeyErrorOn(err, "claimReference")) {
        logger.warn({ attempt }, "carrefour_balloon claim reference collision, retrying");
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  throw lastError instanceof Error ? lastError : new AppError("Failed to record win", 500);
};
