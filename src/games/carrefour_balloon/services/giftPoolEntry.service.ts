import { AppError } from "../../../core/utils/AppError";
import { Gift } from "../models/Gift";
import { GiftPool } from "../models/GiftPool";
import { GiftPoolEntry, GiftPoolEntryDocument } from "../models/GiftPoolEntry";
import { StockAdjustment } from "../models/StockAdjustment";
import { assertEventOwnedByOrg, bumpConfigVersion } from "./eventAccess";
import { getPoolOrThrow } from "./giftPool.service";
import { assertProbabilityBudget } from "./probability.service";
import { broadcastPoolUpdate } from "../sockets/broadcast";

export interface GiftPoolEntryPayload {
  id: string;
  giftId: string;
  visible: boolean;
  awardEnabled: boolean;
  availableQuantity: number;
  probabilityPercent: number;
  displayOrder: number;
}

const toEntryPayload = (entry: GiftPoolEntryDocument): GiftPoolEntryPayload => ({
  id: entry._id.toString(),
  giftId: entry.giftId.toString(),
  visible: entry.visible,
  awardEnabled: entry.awardEnabled,
  availableQuantity: entry.availableQuantity,
  probabilityPercent: entry.probabilityPercent,
  displayOrder: entry.displayOrder,
});

export const listEntries = async (
  organizationId: string,
  eventId: string,
  poolId: string
): Promise<GiftPoolEntryPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  await getPoolOrThrow(eventId, poolId);
  const entries = await GiftPoolEntry.find({ giftPoolId: poolId }).sort({ displayOrder: 1 });
  return entries.map(toEntryPayload);
};

export interface GiftPoolEntryInput {
  giftId: string;
  visible?: boolean;
  awardEnabled?: boolean;
  availableQuantity?: number;
  probabilityPercent: number;
  displayOrder: number;
}

export const createEntry = async (
  organizationId: string,
  eventId: string,
  poolId: string,
  input: GiftPoolEntryInput
): Promise<GiftPoolEntryPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const pool = await getPoolOrThrow(eventId, poolId);

  const gift = await Gift.findOne({ _id: input.giftId, eventId, archivedAt: null });
  if (!gift) {
    throw new AppError("Gift not found for this event", 404);
  }

  const existingEntries = await GiftPoolEntry.find({ giftPoolId: pool._id });
  assertProbabilityBudget(existingEntries, { probabilityPercent: input.probabilityPercent });

  const entry = await GiftPoolEntry.create({
    giftPoolId: pool._id,
    giftId: gift._id,
    visible: input.visible ?? true,
    awardEnabled: input.awardEnabled ?? true,
    availableQuantity: input.availableQuantity ?? 0,
    probabilityPercent: input.probabilityPercent,
    displayOrder: input.displayOrder,
  });

  await bumpConfigVersion(eventId);
  await broadcastPoolUpdate(pool._id.toString());
  return toEntryPayload(entry);
};

export interface UpdateGiftPoolEntryInput {
  visible?: boolean;
  awardEnabled?: boolean;
  probabilityPercent?: number;
  displayOrder?: number;
}

// Deliberately excludes availableQuantity - stock only ever changes through
// adjustStock() below, which logs an audit row. This keeps "a gift is
// displayed" and "a gift's stock changed" fully independent, per the spec.
export const updateEntry = async (
  organizationId: string,
  eventId: string,
  poolId: string,
  entryId: string,
  input: UpdateGiftPoolEntryInput
): Promise<GiftPoolEntryPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const pool = await getPoolOrThrow(eventId, poolId);

  const entry = await GiftPoolEntry.findOne({ _id: entryId, giftPoolId: pool._id });
  if (!entry) {
    throw new AppError("Gift pool entry not found", 404);
  }

  if (input.probabilityPercent !== undefined) {
    const existingEntries = await GiftPoolEntry.find({ giftPoolId: pool._id });
    assertProbabilityBudget(existingEntries, {
      excludeEntryId: entry._id.toString(),
      probabilityPercent: input.probabilityPercent,
    });
  }

  entry.set(input);
  await entry.save();
  await bumpConfigVersion(eventId);
  await broadcastPoolUpdate(pool._id.toString());
  return toEntryPayload(entry);
};

export interface StockAdjustmentPayload {
  giftPoolEntryId: string;
  amount: number;
  reason: string;
  previousQuantity: number;
  newQuantity: number;
  createdAt: Date;
}

// Not nested under a pool in its route (POST /events/:eventId/gift-pool-
// entries/:entryId/stock) since the entry id alone is already enough to
// resolve its pool - this just confirms that pool actually belongs to the
// given event, same scoping discipline as every other admin route.
const getEntryOwnedByEvent = async (
  eventId: string,
  entryId: string
): Promise<GiftPoolEntryDocument> => {
  const entry = await GiftPoolEntry.findById(entryId);
  if (!entry) {
    throw new AppError("Gift pool entry not found", 404);
  }
  const pool = await getPoolOrThrow(eventId, entry.giftPoolId.toString());
  if (pool._id.toString() !== entry.giftPoolId.toString()) {
    throw new AppError("Gift pool entry not found", 404);
  }
  return entry;
};

// Atomic, floor-guarded increment/decrement - never silently clamps to
// zero; an amount that would go negative is rejected outright so the audit
// log and the live quantity can never disagree.
export const adjustStock = async (
  organizationId: string,
  eventId: string,
  entryId: string,
  adminId: string,
  amount: number,
  reason: string
): Promise<StockAdjustmentPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const before = await getEntryOwnedByEvent(eventId, entryId);

  const updated =
    amount >= 0
      ? await GiftPoolEntry.findOneAndUpdate(
          { _id: entryId },
          { $inc: { availableQuantity: amount } },
          { new: true }
        )
      : await GiftPoolEntry.findOneAndUpdate(
          { _id: entryId, availableQuantity: { $gte: -amount } },
          { $inc: { availableQuantity: amount } },
          { new: true }
        );

  if (!updated) {
    throw new AppError("Adjustment would make stock negative", 400);
  }

  const log = await StockAdjustment.create({
    giftPoolEntryId: updated._id,
    adminId,
    amount,
    reason,
    previousQuantity: before.availableQuantity,
    newQuantity: updated.availableQuantity,
  });

  await bumpConfigVersion(eventId);
  await broadcastPoolUpdate(before.giftPoolId.toString());

  return {
    giftPoolEntryId: updated._id.toString(),
    amount: log.amount,
    reason: log.reason,
    previousQuantity: log.previousQuantity,
    newQuantity: log.newQuantity,
    createdAt: log.createdAt,
  };
};

export const listStockAdjustments = async (
  organizationId: string,
  eventId: string,
  giftPoolEntryId?: string
): Promise<StockAdjustmentPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  // Scope to entries that actually belong to one of this event's pools -
  // without this, a valid-but-foreign giftPoolEntryId would leak another
  // organization's audit log.
  const eventPoolIds = (await GiftPool.find({ eventId }).select("_id")).map((p) => p._id);
  const eventEntryIds = (await GiftPoolEntry.find({ giftPoolId: { $in: eventPoolIds } }).select("_id")).map(
    (e) => e._id.toString()
  );

  if (giftPoolEntryId && !eventEntryIds.includes(giftPoolEntryId)) {
    throw new AppError("Gift pool entry not found", 404);
  }

  const filter = giftPoolEntryId
    ? { giftPoolEntryId }
    : { giftPoolEntryId: { $in: eventEntryIds } };
  const logs = await StockAdjustment.find(filter).sort({ createdAt: -1 }).limit(200);
  return logs.map((log) => ({
    giftPoolEntryId: log.giftPoolEntryId.toString(),
    amount: log.amount,
    reason: log.reason,
    previousQuantity: log.previousQuantity,
    newQuantity: log.newQuantity,
    createdAt: log.createdAt,
  }));
};
