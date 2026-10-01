import { AppError } from "../../../core/utils/AppError";
import { GiftDocument } from "../models/Gift";
import { GiftPoolEntryDocument, PROBABILITY_UNITS_TOTAL } from "../models/GiftPoolEntry";

export interface GiftProbabilityBreakdown {
  giftPoolEntryId: string;
  giftId: string;
  // What the admin configured, regardless of current eligibility.
  configuredProbabilityPercent: number;
  // 0 whenever the gift isn't currently awardable - never redistributed to
  // other gifts, per the spec. The remainder always flows to no-gift.
  effectiveProbabilityPercent: number;
  eligible: boolean;
}

export interface PoolProbabilitySummary {
  gifts: GiftProbabilityBreakdown[];
  totalEffectiveWinProbabilityPercent: number;
  effectiveNoGiftProbabilityPercent: number;
}

// A gift is only ever awardable when every one of these holds - visible,
// award-enabled, not archived, and still in stock. Any one failing turns
// its probability into no-gift probability rather than being handed to
// another gift.
export const isGiftEligible = (
  entry: Pick<GiftPoolEntryDocument, "visible" | "awardEnabled" | "availableQuantity">,
  gift: Pick<GiftDocument, "archivedAt">
): boolean =>
  entry.visible && entry.awardEnabled && entry.availableQuantity > 0 && gift.archivedAt === null;

export const summarizePoolProbabilities = (
  entries: Array<{ entry: GiftPoolEntryDocument; gift: GiftDocument }>
): PoolProbabilitySummary => {
  const gifts: GiftProbabilityBreakdown[] = entries
    .filter(({ entry }) => entry.visible)
    .map(({ entry, gift }) => {
      const eligible = isGiftEligible(entry, gift);
      return {
        giftPoolEntryId: entry._id.toString(),
        giftId: gift._id.toString(),
        configuredProbabilityPercent: entry.probabilityPercent,
        effectiveProbabilityPercent: eligible ? entry.probabilityPercent : 0,
        eligible,
      };
    });

  const totalEffectiveWinProbabilityPercent = gifts.reduce(
    (sum, g) => sum + g.effectiveProbabilityPercent,
    0
  );

  return {
    gifts,
    totalEffectiveWinProbabilityPercent,
    effectiveNoGiftProbabilityPercent: PROBABILITY_UNITS_TOTAL - totalEffectiveWinProbabilityPercent,
  };
};

// Validated against every configured entry in the pool - including hidden
// or award-disabled ones - so re-enabling a gift later can never silently
// push the pool's total over 100%.
export const assertProbabilityBudget = (
  existingEntries: Array<Pick<GiftPoolEntryDocument, "_id" | "probabilityPercent">>,
  candidate: { excludeEntryId?: string; probabilityPercent: number }
): void => {
  const existingTotal = existingEntries
    .filter((e) => e._id.toString() !== candidate.excludeEntryId)
    .reduce((sum, e) => sum + e.probabilityPercent, 0);

  const newTotal = existingTotal + candidate.probabilityPercent;
  if (newTotal > PROBABILITY_UNITS_TOTAL) {
    throw new AppError(
      `Total configured gift probability for this pool would be ${newTotal / 100}%, which exceeds 100%`,
      400
    );
  }
};
