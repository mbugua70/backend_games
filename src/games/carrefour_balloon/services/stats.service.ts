import { Gift } from "../models/Gift";
import { GiftPool } from "../models/GiftPool";
import { GiftPoolEntry } from "../models/GiftPoolEntry";
import { WinningRecord } from "../models/WinningRecord";
import { assertEventOwnedByOrg } from "./eventAccess";

export interface GiftStockStat {
  giftId: string;
  giftName: string;
  giftPoolId: string;
  availableQuantity: number;
  acceptedWins: number;
}

export interface EventStats {
  totalAcceptedWins: number;
  totalClaimedWins: number;
  giftStock: GiftStockStat[];
}

// Only accepted-win and remaining-stock figures - the frontend never
// reports total plays or losing pops (losing pops hit no backend endpoint
// at all), so this deliberately has no "total plays"/"conversion rate"
// field to avoid implying data this backend doesn't have.
export const getEventStats = async (organizationId: string, eventId: string): Promise<EventStats> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const pools = await GiftPool.find({ eventId }).select("_id");
  const poolIds = pools.map((p) => p._id);
  const entries = await GiftPoolEntry.find({ giftPoolId: { $in: poolIds } });
  const giftIds = entries.map((e) => e.giftId);
  const gifts = await Gift.find({ _id: { $in: giftIds } });
  const giftNameById = new Map(gifts.map((g) => [g._id.toString(), g.name]));

  // entries is already scoped to this event's pools, so filtering wins by
  // giftPoolEntryId here is equivalent to (and avoids a redundant) scoping
  // by eventId directly.
  const winCountsByEntry = await WinningRecord.aggregate<{ _id: string; count: number }>([
    { $match: { giftPoolEntryId: { $in: entries.map((e) => e._id) } } },
    { $group: { _id: "$giftPoolEntryId", count: { $sum: 1 } } },
  ]);
  const winCountByEntryId = new Map(winCountsByEntry.map((w) => [w._id.toString(), w.count]));

  const giftStock: GiftStockStat[] = entries.map((entry) => ({
    giftId: entry.giftId.toString(),
    giftName: giftNameById.get(entry.giftId.toString()) ?? "Unknown gift",
    giftPoolId: entry.giftPoolId.toString(),
    availableQuantity: entry.availableQuantity,
    acceptedWins: winCountByEntryId.get(entry._id.toString()) ?? 0,
  }));

  const [totalAcceptedWins, totalClaimedWins] = await Promise.all([
    WinningRecord.countDocuments({ eventId }),
    WinningRecord.countDocuments({ eventId, claimStatus: "claimed" }),
  ]);

  return { totalAcceptedWins, totalClaimedWins, giftStock };
};
