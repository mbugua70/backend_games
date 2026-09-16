import { describe, expect, it } from "vitest";
import {
  computeAverage,
  computeTotal,
  findStrongestDimensions,
  findWeakestDimensions,
  summarizeScores,
} from "../../src/games/safaricom_ceo/services/scoring.service";
import { Dimension } from "../../src/games/safaricom_ceo/models/Question";

const scores = (values: [Dimension, number][]) =>
  values.map(([dimension, score]) => ({ dimension, score }));

describe("scoring.service", () => {
  it("computes total and average from the spec's worked example", () => {
    const input = scores([
      ["VISIBILITY", 4],
      ["EFFICIENCY", 2],
      ["CONNECTEDNESS", 5],
      ["RESILIENCE", 3],
      ["INTELLIGENCE", 4],
    ]);
    expect(computeTotal(input)).toBe(18);
    expect(computeAverage(input)).toBe(3.6);
  });

  it("picks a single strongest and weakest dimension when there is no tie", () => {
    const input = scores([
      ["VISIBILITY", 4],
      ["EFFICIENCY", 2],
      ["CONNECTEDNESS", 5],
      ["RESILIENCE", 3],
      ["INTELLIGENCE", 4],
    ]);
    expect(findStrongestDimensions(input)).toEqual(["CONNECTEDNESS"]);
    expect(findWeakestDimensions(input)).toEqual(["EFFICIENCY"]);
  });

  it("returns every dimension tied at the max/min, never picking one arbitrarily", () => {
    const input = scores([
      ["VISIBILITY", 5],
      ["EFFICIENCY", 5],
      ["CONNECTEDNESS", 3],
      ["RESILIENCE", 2],
      ["INTELLIGENCE", 2],
    ]);
    expect(findStrongestDimensions(input)).toEqual(["VISIBILITY", "EFFICIENCY"]);
    expect(findWeakestDimensions(input)).toEqual(["RESILIENCE", "INTELLIGENCE"]);
  });

  it("handles an all-tied set as every dimension being both strongest and weakest", () => {
    const input = scores([
      ["VISIBILITY", 3],
      ["EFFICIENCY", 3],
      ["CONNECTEDNESS", 3],
      ["RESILIENCE", 3],
      ["INTELLIGENCE", 3],
    ]);
    expect(findStrongestDimensions(input)).toHaveLength(5);
    expect(findWeakestDimensions(input)).toHaveLength(5);
  });

  it("summarizeScores bundles all four derived values together", () => {
    const input = scores([
      ["VISIBILITY", 4],
      ["EFFICIENCY", 2],
      ["CONNECTEDNESS", 5],
      ["RESILIENCE", 3],
      ["INTELLIGENCE", 4],
    ]);
    expect(summarizeScores(input)).toEqual({
      dimensionScores: input,
      total: 18,
      average: 3.6,
      strongest: ["CONNECTEDNESS"],
      weakest: ["EFFICIENCY"],
    });
  });

  it("treats an empty score set as zero rather than throwing", () => {
    expect(computeTotal([])).toBe(0);
    expect(computeAverage([])).toBe(0);
    expect(findStrongestDimensions([])).toEqual([]);
    expect(findWeakestDimensions([])).toEqual([]);
  });
});
