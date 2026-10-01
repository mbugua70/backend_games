import { Gift } from "../models/Gift";
import { GiftPoolDocument } from "../models/GiftPool";
import { GiftPoolEntry } from "../models/GiftPoolEntry";
import { GameConfigGiftSummary } from "./gameConfig.service";
import { isGiftEligible, summarizePoolProbabilities } from "./probability.service";

export interface PoolSnapshot {
  giftPoolId: string;
  balloonSettings: {
    balloonCount: number;
    guaranteedNoGiftBalloonCount: number;
    maxPopsPerRound: number;
    maxWinsPerRound: number;
  };
  gifts: GameConfigGiftSummary[];
  effectiveNoGiftProbabilityPercent: number;
  messages: { win: string | null; lose: string | null; unavailable: string | null };
}

// The brand-agnostic half of gameConfig.service.ts's mapper, factored out
// so both GET /game-config and the socket layer's broadcastPoolUpdate()
// (sockets/broadcast.ts) compute gift/stock/probability fields identically
// - neither can drift from the other on what a pool's current state is.
export const buildPoolSnapshot = async (pool: GiftPoolDocument): Promise<PoolSnapshot> => {
  const entries = await GiftPoolEntry.find({ giftPoolId: pool._id }).sort({ displayOrder: 1 });
  const giftIds = entries.map((e) => e.giftId);
  const giftDocs = await Gift.find({ _id: { $in: giftIds } });
  const giftById = new Map(giftDocs.map((g) => [g._id.toString(), g]));

  const visibleEntries = entries
    .map((entry) => ({ entry, gift: giftById.get(entry.giftId.toString()) }))
    .filter((pair): pair is { entry: typeof pair.entry; gift: NonNullable<typeof pair.gift> } =>
      Boolean(pair.gift)
    );

  const summary = summarizePoolProbabilities(visibleEntries);

  const gifts: GameConfigGiftSummary[] = visibleEntries
    .filter(({ entry }) => entry.visible)
    .map(({ entry, gift }) => ({
      id: gift._id.toString(),
      name: gift.name,
      description: gift.description,
      imageUrl: gift.imageUrl,
      availableQuantity: entry.availableQuantity,
      configuredProbabilityPercent: entry.probabilityPercent,
      effectiveProbabilityPercent: isGiftEligible(entry, gift) ? entry.probabilityPercent : 0,
      eligible: isGiftEligible(entry, gift),
    }));

  return {
    giftPoolId: pool._id.toString(),
    balloonSettings: {
      balloonCount: pool.balloonCount,
      guaranteedNoGiftBalloonCount: pool.guaranteedNoGiftBalloonCount,
      maxPopsPerRound: pool.maxPopsPerRound,
      maxWinsPerRound: pool.maxWinsPerRound,
    },
    gifts,
    effectiveNoGiftProbabilityPercent: summary.effectiveNoGiftProbabilityPercent,
    messages: pool.messages,
  };
};
