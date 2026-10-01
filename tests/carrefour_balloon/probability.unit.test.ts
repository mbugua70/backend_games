import { describe, expect, it } from "vitest";
import {
  assertProbabilityBudget,
  isGiftEligible,
  summarizePoolProbabilities,
} from "../../src/games/carrefour_balloon/services/probability.service";
import { GiftDocument } from "../../src/games/carrefour_balloon/models/Gift";
import { GiftPoolEntryDocument } from "../../src/games/carrefour_balloon/models/GiftPoolEntry";

let nextId = 0;
const fakeId = (): string => `id-${(nextId += 1)}`;

const fakeEntry = (overrides: Partial<GiftPoolEntryDocument> = {}): GiftPoolEntryDocument => {
  const id = fakeId();
  return {
    _id: { toString: () => id },
    visible: true,
    awardEnabled: true,
    availableQuantity: 10,
    probabilityPercent: 500,
    ...overrides,
  } as unknown as GiftPoolEntryDocument;
};

const fakeGift = (overrides: Partial<GiftDocument> = {}): GiftDocument => {
  const id = fakeId();
  return {
    _id: { toString: () => id },
    archivedAt: null,
    ...overrides,
  } as unknown as GiftDocument;
};

describe("probability.service", () => {
  describe("isGiftEligible", () => {
    it("is eligible when visible, award-enabled, in stock, and not archived", () => {
      expect(isGiftEligible(fakeEntry(), fakeGift())).toBe(true);
    });

    it("is ineligible when hidden", () => {
      expect(isGiftEligible(fakeEntry({ visible: false }), fakeGift())).toBe(false);
    });

    it("is ineligible when award-disabled", () => {
      expect(isGiftEligible(fakeEntry({ awardEnabled: false }), fakeGift())).toBe(false);
    });

    it("is ineligible when out of stock", () => {
      expect(isGiftEligible(fakeEntry({ availableQuantity: 0 }), fakeGift())).toBe(false);
    });

    it("is ineligible when the gift is archived", () => {
      expect(isGiftEligible(fakeEntry(), fakeGift({ archivedAt: new Date() }))).toBe(false);
    });
  });

  describe("summarizePoolProbabilities", () => {
    it("zeroes out an ineligible gift's effective probability without redistributing it", () => {
      const eligible = { entry: fakeEntry({ probabilityPercent: 500 }), gift: fakeGift() };
      const outOfStock = {
        entry: fakeEntry({ probabilityPercent: 1500, availableQuantity: 0 }),
        gift: fakeGift(),
      };

      const summary = summarizePoolProbabilities([eligible, outOfStock]);

      const outOfStockBreakdown = summary.gifts.find(
        (g) => g.giftPoolEntryId === outOfStock.entry._id.toString()
      );
      expect(outOfStockBreakdown?.configuredProbabilityPercent).toBe(1500);
      expect(outOfStockBreakdown?.effectiveProbabilityPercent).toBe(0);

      // Only the eligible gift's share counts toward the total - the
      // out-of-stock gift's 1500 units become no-gift probability instead
      // of being handed to the eligible gift.
      expect(summary.totalEffectiveWinProbabilityPercent).toBe(500);
      expect(summary.effectiveNoGiftProbabilityPercent).toBe(10_000 - 500);
    });

    it("excludes hidden gifts from the returned list entirely", () => {
      const hidden = { entry: fakeEntry({ visible: false }), gift: fakeGift() };
      const summary = summarizePoolProbabilities([hidden]);
      expect(summary.gifts).toHaveLength(0);
    });
  });

  describe("assertProbabilityBudget", () => {
    it("allows a total up to exactly 100%", () => {
      const existing = [fakeEntry({ probabilityPercent: 4000 })];
      expect(() =>
        assertProbabilityBudget(existing, { probabilityPercent: 6000 })
      ).not.toThrow();
    });

    it("rejects a total over 100%", () => {
      const existing = [fakeEntry({ probabilityPercent: 4000 })];
      expect(() =>
        assertProbabilityBudget(existing, { probabilityPercent: 6001 })
      ).toThrow(/exceeds 100%/);
    });

    it("counts hidden/disabled entries toward the budget too", () => {
      const existing = [fakeEntry({ probabilityPercent: 9000, visible: false, awardEnabled: false })];
      expect(() =>
        assertProbabilityBudget(existing, { probabilityPercent: 1500 })
      ).toThrow(/exceeds 100%/);
    });

    it("excludes the entry being updated from its own prior contribution", () => {
      const target = fakeEntry({ probabilityPercent: 5000 });
      const other = fakeEntry({ probabilityPercent: 3000 });
      expect(() =>
        assertProbabilityBudget([target, other], {
          excludeEntryId: target._id.toString(),
          probabilityPercent: 7000,
        })
      ).not.toThrow();
    });
  });
});
