import { QueryFilter } from "mongoose";
import { AppError } from "../../../core/utils/AppError";
import { ClaimStatus, WinningRecord, WinningRecordDocument } from "../models/WinningRecord";
import { assertEventOwnedByOrg } from "./eventAccess";

export interface WinningRecordPayload {
  id: string;
  brandId: string;
  giftId: string;
  giftName: string;
  giftImageUrl: string | null;
  roundId: string;
  balloonId: string;
  participantId: string | null;
  anonymousIdentity: string | null;
  claimReference: string;
  claimStatus: ClaimStatus;
  claimedAt: Date | null;
  claimedByAdminId: string | null;
  receivedAt: Date;
}

const toPayload = (record: WinningRecordDocument): WinningRecordPayload => ({
  id: record._id.toString(),
  brandId: record.brandId.toString(),
  giftId: record.giftId.toString(),
  giftName: record.giftNameSnapshot,
  giftImageUrl: record.giftImageUrlSnapshot,
  roundId: record.roundId,
  balloonId: record.balloonId,
  participantId: record.participantId ? record.participantId.toString() : null,
  anonymousIdentity: record.anonymousIdentity,
  claimReference: record.claimReference,
  claimStatus: record.claimStatus,
  claimedAt: record.claimedAt,
  claimedByAdminId: record.claimedByAdminId ? record.claimedByAdminId.toString() : null,
  receivedAt: record.receivedAt,
});

export interface ListWinsFilter {
  brandId?: string;
  claimStatus?: ClaimStatus;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface ListWinsResult {
  items: WinningRecordPayload[];
  total: number;
  page: number;
  pageSize: number;
}

export const listWins = async (
  organizationId: string,
  eventId: string,
  filter: ListWinsFilter
): Promise<ListWinsResult> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const query: QueryFilter<WinningRecordDocument> = { eventId };
  if (filter.brandId) query.brandId = filter.brandId;
  if (filter.claimStatus) query.claimStatus = filter.claimStatus;
  if (filter.from || filter.to) {
    query.createdAt = {
      ...(filter.from && { $gte: filter.from }),
      ...(filter.to && { $lte: filter.to }),
    };
  }

  const skip = (filter.page - 1) * filter.pageSize;
  const [items, total] = await Promise.all([
    WinningRecord.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.pageSize),
    WinningRecord.countDocuments(query),
  ]);

  return { items: items.map(toPayload), total, page: filter.page, pageSize: filter.pageSize };
};

// Atomic pending -> claimed flip, guarded so a second claim attempt on the
// same win (double-tap, or two admins) can never succeed twice.
export const markWinClaimed = async (
  organizationId: string,
  eventId: string,
  winId: string,
  adminId: string
): Promise<WinningRecordPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const record = await WinningRecord.findOneAndUpdate(
    { _id: winId, eventId, claimStatus: "pending" },
    { $set: { claimStatus: "claimed", claimedAt: new Date(), claimedByAdminId: adminId } },
    { new: true }
  );
  if (!record) {
    const existing = await WinningRecord.findOne({ _id: winId, eventId });
    if (!existing) {
      throw new AppError("Winning record not found", 404);
    }
    throw new AppError("This win has already been claimed", 409);
  }
  return toPayload(record);
};
