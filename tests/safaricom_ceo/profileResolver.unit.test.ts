import { describe, expect, it } from "vitest";
import {
  DimensionPatternProfileResolver,
  getProfileResolver,
} from "../../src/games/safaricom_ceo/services/profileResolver.service";
import { summarizeScores } from "../../src/games/safaricom_ceo/services/scoring.service";

function resolve(
  scores: { dimension: Parameters<typeof summarizeScores>[0][number]["dimension"]; score: number }[]
) {
  const summary = summarizeScores(scores);
  return new DimensionPatternProfileResolver().resolve({ ...summary, organizationId: "org" });
}

describe("profileResolver.service", () => {
  it("resolves CONNECTED_OPERATOR when connectedness is the strongest dimension", () => {
    const result = resolve([
      { dimension: "VISIBILITY", score: 3 },
      { dimension: "EFFICIENCY", score: 3 },
      { dimension: "CONNECTEDNESS", score: 5 },
      { dimension: "RESILIENCE", score: 2 },
      { dimension: "INTELLIGENCE", score: 3 },
    ]);
    expect(result.profileCode).toBe("CONNECTED_OPERATOR");
  });

  it("resolves INTELLIGENT_GROWTH_BUILDER when intelligence is the strongest dimension", () => {
    const result = resolve([
      { dimension: "VISIBILITY", score: 2 },
      { dimension: "EFFICIENCY", score: 3 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 2 },
      { dimension: "INTELLIGENCE", score: 5 },
    ]);
    expect(result.profileCode).toBe("INTELLIGENT_GROWTH_BUILDER");
  });

  it("resolves RESILIENCE_LEADER when resilience is the strongest dimension", () => {
    const result = resolve([
      { dimension: "VISIBILITY", score: 2 },
      { dimension: "EFFICIENCY", score: 2 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 5 },
      { dimension: "INTELLIGENCE", score: 3 },
    ]);
    expect(result.profileCode).toBe("RESILIENCE_LEADER");
  });

  it("resolves FOUNDATION_BUILDER when visibility or efficiency is strongest (no dedicated profile)", () => {
    const visibilityStrongest = resolve([
      { dimension: "VISIBILITY", score: 5 },
      { dimension: "EFFICIENCY", score: 2 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 2 },
      { dimension: "INTELLIGENCE", score: 3 },
    ]);
    expect(visibilityStrongest.profileCode).toBe("FOUNDATION_BUILDER");

    const efficiencyStrongest = resolve([
      { dimension: "VISIBILITY", score: 2 },
      { dimension: "EFFICIENCY", score: 5 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 2 },
      { dimension: "INTELLIGENCE", score: 3 },
    ]);
    expect(efficiencyStrongest.profileCode).toBe("FOUNDATION_BUILDER");
  });

  it("resolves FUTURE_READY_ENTERPRISE when the average is high across all dimensions, overriding a single strongest dimension", () => {
    // CONNECTEDNESS is technically the single strongest score here, but the
    // average (4.6) crosses the "strong everywhere" threshold, which should
    // win over any single-dimension mapping.
    const result = resolve([
      { dimension: "VISIBILITY", score: 5 },
      { dimension: "EFFICIENCY", score: 4 },
      { dimension: "CONNECTEDNESS", score: 5 },
      { dimension: "RESILIENCE", score: 4 },
      { dimension: "INTELLIGENCE", score: 5 },
    ]);
    expect(result.profileCode).toBe("FUTURE_READY_ENTERPRISE");
  });

  it("picks the primary dimension by canonical DIMENSIONS order, not answer order, when there's a tie", () => {
    // RESILIENCE and INTELLIGENCE tie for strongest; RESILIENCE comes first
    // in the canonical dimension order, so RESILIENCE_LEADER should win
    // regardless of which question was answered first.
    const result = resolve([
      { dimension: "VISIBILITY", score: 2 },
      { dimension: "EFFICIENCY", score: 2 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 5 },
      { dimension: "INTELLIGENCE", score: 5 },
    ]);
    expect(result.profileCode).toBe("RESILIENCE_LEADER");
  });

  it("derives strengths from the strongest dimension(s), unchanged from before", () => {
    const result = resolve([
      { dimension: "VISIBILITY", score: 5 },
      { dimension: "EFFICIENCY", score: 5 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 2 },
      { dimension: "INTELLIGENCE", score: 2 },
    ]);
    expect(result.strengths).toEqual(["VISIBILITY", "EFFICIENCY"]);
  });

  it("derives nextFrontier as {dimension, explanation} entries for every weakest dimension", () => {
    const result = resolve([
      { dimension: "VISIBILITY", score: 5 },
      { dimension: "EFFICIENCY", score: 5 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 2 },
      { dimension: "INTELLIGENCE", score: 2 },
    ]);
    expect(result.nextFrontier).toHaveLength(2);
    expect(result.nextFrontier.map((entry) => entry.dimension)).toEqual([
      "RESILIENCE",
      "INTELLIGENCE",
    ]);
    for (const entry of result.nextFrontier) {
      expect(typeof entry.explanation).toBe("string");
      expect(entry.explanation.length).toBeGreaterThan(0);
    }
  });

  it("sets ceoQuestion from the primary next-frontier dimension", () => {
    const result = resolve([
      { dimension: "VISIBILITY", score: 4 },
      { dimension: "EFFICIENCY", score: 4 },
      { dimension: "CONNECTEDNESS", score: 4 },
      { dimension: "RESILIENCE", score: 1 },
      { dimension: "INTELLIGENCE", score: 3 },
    ]);
    expect(result.ceoQuestion).toBe(
      "What would become possible if your business could see disruption before it felt it?"
    );
  });

  it("is no longer a placeholder", () => {
    const result = resolve([
      { dimension: "VISIBILITY", score: 3 },
      { dimension: "EFFICIENCY", score: 3 },
      { dimension: "CONNECTEDNESS", score: 3 },
      { dimension: "RESILIENCE", score: 3 },
      { dimension: "INTELLIGENCE", score: 3 },
    ]);
    expect(result.isPlaceholder).toBe(false);
    expect(result.profileCode).not.toBeNull();
  });

  it("getProfileResolver returns a resolver conforming to the ProfileResolver interface", () => {
    const resolver = getProfileResolver();
    expect(typeof resolver.resolve).toBe("function");
  });
});
