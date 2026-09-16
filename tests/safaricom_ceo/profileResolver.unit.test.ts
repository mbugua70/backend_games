import { describe, expect, it } from "vitest";
import {
  getProfileResolver,
  PlaceholderProfileResolver,
} from "../../src/games/safaricom_ceo/services/profileResolver.service";
import { summarizeScores } from "../../src/games/safaricom_ceo/services/scoring.service";

describe("profileResolver.service", () => {
  it("never resolves a profile code - no thresholds have been approved yet", () => {
    const summary = summarizeScores([
      { dimension: "VISIBILITY", score: 4 },
      { dimension: "EFFICIENCY", score: 2 },
      { dimension: "CONNECTEDNESS", score: 5 },
      { dimension: "RESILIENCE", score: 3 },
      { dimension: "INTELLIGENCE", score: 4 },
    ]);

    const result = new PlaceholderProfileResolver().resolve({
      ...summary,
      organizationId: "irrelevant-for-the-placeholder",
    });

    expect(result.profileCode).toBeNull();
    expect(result.isPlaceholder).toBe(true);
    expect(result.ceoQuestion).toBeNull();
  });

  it("derives strengths/nextFrontier purely from the already-computed strongest/weakest", () => {
    const summary = summarizeScores([
      { dimension: "VISIBILITY", score: 5 },
      { dimension: "EFFICIENCY", score: 5 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 2 },
      { dimension: "INTELLIGENCE", score: 2 },
    ]);

    const result = new PlaceholderProfileResolver().resolve({
      ...summary,
      organizationId: "org",
    });

    expect(result.strengths).toEqual(["VISIBILITY", "EFFICIENCY"]);
    expect(result.nextFrontier).toEqual(["RESILIENCE", "INTELLIGENCE"]);
  });

  it("getProfileResolver returns a resolver conforming to the ProfileResolver interface", () => {
    const resolver = getProfileResolver();
    expect(typeof resolver.resolve).toBe("function");
  });
});
