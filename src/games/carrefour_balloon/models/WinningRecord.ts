import { Document, Schema, Types, model } from "mongoose";
import "./Event";
import "./Brand";
import "./GiftPool";
import "./GiftPoolEntry";
import "./Gift";
import "./Participant";
import "./Admin";

export type ClaimStatus = "pending" | "claimed";

// The authoritative win ledger - the only place a balloon's outcome is ever
// persisted, and only when it actually won something. Losing/empty pops are
// never recorded (the spec's "no backend request for a losing pop"), so
// this collection has no concept of total plays or loss counts.
export interface WinningRecordDocument extends Document {
  eventId: Types.ObjectId;
  brandId: Types.ObjectId;
  giftPoolId: Types.ObjectId;
  giftPoolEntryId: Types.ObjectId;
  giftId: Types.ObjectId;
  // Snapshotted at award time so an edit/archive to Gift afterward never
  // changes what a past winning record displays.
  giftNameSnapshot: string;
  giftImageUrlSnapshot: string | null;
  // The client's submitted Event.configVersion at the moment it decided
  // this was a win - stored for audit only, not re-validated as a
  // precondition (eligibility is always re-checked live; see
  // services/win.service.ts).
  configVersion: number;
  // Client-generated opaque identifiers - the backend never generates or
  // stores individual balloon outcomes, only which (round, balloon) pair
  // actually won, so a duplicate submission for the same pair can be
  // rejected.
  roundId: string;
  balloonId: string;
  participantId: Types.ObjectId | null;
  // Client-generated identity used for duplicate-award scoping when
  // registration is disabled - never implied to guarantee one real person
  // per identity.
  anonymousIdentity: string | null;
  idempotencyKey: string;
  // Hash of the normalized request so a reused idempotency key with
  // different data can be rejected instead of silently returning a
  // mismatched cached result.
  requestFingerprint: string;
  claimReference: string;
  claimStatus: ClaimStatus;
  claimedAt: Date | null;
  claimedByAdminId: Types.ObjectId | null;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const winningRecordSchema = new Schema<WinningRecordDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonEvent", required: true },
    brandId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonBrand", required: true },
    giftPoolId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonGiftPool", required: true },
    giftPoolEntryId: {
      type: Schema.Types.ObjectId,
      ref: "CarrefourBalloonGiftPoolEntry",
      required: true,
    },
    giftId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonGift", required: true },
    giftNameSnapshot: { type: String, required: true, trim: true },
    giftImageUrlSnapshot: { type: String, default: null, trim: true },
    configVersion: { type: Number, required: true },
    roundId: { type: String, required: true, trim: true },
    balloonId: { type: String, required: true, trim: true },
    participantId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonParticipant", default: null },
    anonymousIdentity: { type: String, default: null, trim: true },
    idempotencyKey: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
    claimReference: { type: String, required: true },
    claimStatus: { type: String, required: true, enum: ["pending", "claimed"], default: "pending" },
    claimedAt: { type: Date, default: null },
    claimedByAdminId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonAdmin", default: null },
    receivedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

winningRecordSchema.index({ idempotencyKey: 1 }, { unique: true });
winningRecordSchema.index({ claimReference: 1 }, { unique: true });
// Duplicate-balloon-award prevention: the same round+balloon can only ever
// win once.
winningRecordSchema.index({ eventId: 1, brandId: 1, roundId: 1, balloonId: 1 }, { unique: true });
winningRecordSchema.index({ eventId: 1, createdAt: -1 });
winningRecordSchema.index({ eventId: 1, claimStatus: 1 });
winningRecordSchema.index({ giftPoolEntryId: 1 });

export const WinningRecord = model<WinningRecordDocument>(
  "CarrefourBalloonWinningRecord",
  winningRecordSchema,
  "carrefour_balloon_winning_records"
);
