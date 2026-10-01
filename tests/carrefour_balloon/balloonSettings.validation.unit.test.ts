import { describe, expect, it } from "vitest";
import { validateBalloonSettings } from "../../src/games/carrefour_balloon/services/giftPool.service";

const base = {
  balloonCount: 20,
  guaranteedNoGiftBalloonCount: 5,
  maxPopsPerRound: 5,
  maxWinsPerRound: 1,
};

describe("validateBalloonSettings", () => {
  it("accepts a well-formed configuration", () => {
    expect(() => validateBalloonSettings(base)).not.toThrow();
  });

  it("rejects a non-positive balloonCount", () => {
    expect(() => validateBalloonSettings({ ...base, balloonCount: 0 })).toThrow(/balloonCount/);
  });

  it("rejects guaranteedNoGiftBalloonCount above balloonCount", () => {
    expect(() =>
      validateBalloonSettings({ ...base, guaranteedNoGiftBalloonCount: 21 })
    ).toThrow(/guaranteedNoGiftBalloonCount/);
  });

  it("allows guaranteedNoGiftBalloonCount of exactly balloonCount", () => {
    expect(() =>
      validateBalloonSettings({ ...base, guaranteedNoGiftBalloonCount: 20 })
    ).not.toThrow();
  });

  it("rejects maxPopsPerRound of zero", () => {
    expect(() => validateBalloonSettings({ ...base, maxPopsPerRound: 0 })).toThrow(/maxPopsPerRound/);
  });

  it("rejects maxPopsPerRound above balloonCount", () => {
    expect(() => validateBalloonSettings({ ...base, maxPopsPerRound: 21 })).toThrow(/maxPopsPerRound/);
  });

  it("rejects maxWinsPerRound above maxPopsPerRound", () => {
    expect(() =>
      validateBalloonSettings({ ...base, maxWinsPerRound: 6 })
    ).toThrow(/maxWinsPerRound/);
  });

  it("allows maxWinsPerRound of zero", () => {
    expect(() => validateBalloonSettings({ ...base, maxWinsPerRound: 0 })).not.toThrow();
  });
});
