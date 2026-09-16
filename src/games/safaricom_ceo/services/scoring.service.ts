import { Dimension } from "../models/Question";

export interface DimensionScore {
  dimension: Dimension;
  score: number;
}

export interface ScoringSummary {
  dimensionScores: DimensionScore[];
  total: number;
  average: number;
  // Arrays, not single values - a tie (e.g. two dimensions both scoring the
  // max) must surface as multiple strongest/weakest dimensions rather than
  // an arbitrary single pick.
  strongest: Dimension[];
  weakest: Dimension[];
}

// Bump this whenever the calculation in this file changes in a way that
// would alter a NEW session's numbers - see SessionResult.scoringVersion
// and services/session.service.ts. Historical results are never
// recalculated under a new version; they keep the version (and the
// dimensionScores snapshot) they were created with.
export const SCORING_VERSION = "scoring-v1";

export const computeTotal = (scores: DimensionScore[]): number =>
  scores.reduce((sum, s) => sum + s.score, 0);

export const computeAverage = (scores: DimensionScore[]): number => {
  if (scores.length === 0) {
    return 0;
  }
  return Math.round((computeTotal(scores) / scores.length) * 100) / 100;
};

const dimensionsAtExtreme = (
  scores: DimensionScore[],
  isMoreExtreme: (candidate: number, current: number) => boolean
): Dimension[] => {
  if (scores.length === 0) {
    return [];
  }
  const extreme = scores.reduce(
    (current, s) => (isMoreExtreme(s.score, current) ? s.score : current),
    scores[0]!.score
  );
  return scores.filter((s) => s.score === extreme).map((s) => s.dimension);
};

// Ties intentionally return every dimension at the max, e.g. scores of
// 5,5,3,2,2 return both 5-scoring dimensions as strongest.
export const findStrongestDimensions = (scores: DimensionScore[]): Dimension[] =>
  dimensionsAtExtreme(scores, (candidate, current) => candidate > current);

// Same tie handling at the min, e.g. 5,5,3,2,2 returns both 2-scoring
// dimensions as weakest.
export const findWeakestDimensions = (scores: DimensionScore[]): Dimension[] =>
  dimensionsAtExtreme(scores, (candidate, current) => candidate < current);

export const summarizeScores = (scores: DimensionScore[]): ScoringSummary => ({
  dimensionScores: scores,
  total: computeTotal(scores),
  average: computeAverage(scores),
  strongest: findStrongestDimensions(scores),
  weakest: findWeakestDimensions(scores),
});
