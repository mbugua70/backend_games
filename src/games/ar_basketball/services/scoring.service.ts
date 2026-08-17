// Pure and transport/DB-agnostic on purpose: no Express or Mongoose
// imports, so it's trivially unit-testable in isolation and can never
// drift from what the client's shot log actually produces.

export type ShotResult = "made" | "missed";

export interface ScoringConfig {
  normalBasketPoints: number;
  swishEnabled: boolean;
  swishPoints: number;
  longRangeEnabled: boolean;
  longRangeDistanceMeters: number;
  longRangePoints: number;
  streakEnabled: boolean;
  streakRequired: number;
  streakBonusPoints: number;
}

export interface RawShot {
  result: ShotResult;
  touchedRim: boolean;
  touchedBackboard: boolean;
  distanceMeters: number;
  shotAt?: Date;
}

export interface ScoredShot {
  result: ShotResult;
  touchedRim: boolean;
  touchedBackboard: boolean;
  distanceMeters: number;
  isSwish: boolean;
  isLongRange: boolean;
  streakAtShot: number;
  pointsAwarded: number;
  shotAt: Date | null;
}

export interface ScoringResult {
  shots: ScoredShot[];
  totalScore: number;
  totalBaskets: number;
  totalMisses: number;
  totalSwishes: number;
  totalLongRangeBaskets: number;
  totalLongRangeAttempts: number;
  bestStreak: number;
  accuracy: number;
}

// Swish and long-range baskets REPLACE normal-basket points for that shot
// (never additive with each other or with normalBasketPoints) - swish is
// checked first since a shot can only be one or the other, not both. The
// streak bonus is separate and IS additive to whichever basket points that
// shot already earned, awarded every time the consecutive-makes counter
// hits a multiple of streakRequired; any miss resets the counter to 0.
export const computeShots = (shots: RawShot[], config: ScoringConfig): ScoringResult => {
  let streak = 0;
  let bestStreak = 0;
  let totalBaskets = 0;
  let totalMisses = 0;
  let totalSwishes = 0;
  let totalLongRangeBaskets = 0;
  let totalLongRangeAttempts = 0;

  const scoredShots: ScoredShot[] = shots.map((shot) => {
    if (shot.distanceMeters >= config.longRangeDistanceMeters) {
      totalLongRangeAttempts += 1;
    }

    if (shot.result === "missed") {
      streak = 0;
      totalMisses += 1;
      return {
        result: shot.result,
        touchedRim: shot.touchedRim,
        touchedBackboard: shot.touchedBackboard,
        distanceMeters: shot.distanceMeters,
        isSwish: false,
        isLongRange: false,
        streakAtShot: 0,
        pointsAwarded: 0,
        shotAt: shot.shotAt ?? null,
      };
    }

    totalBaskets += 1;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);

    const isSwish = config.swishEnabled && !shot.touchedRim && !shot.touchedBackboard;
    const isLongRange =
      !isSwish &&
      config.longRangeEnabled &&
      shot.distanceMeters >= config.longRangeDistanceMeters;

    let pointsAwarded: number;
    if (isSwish) {
      pointsAwarded = config.swishPoints;
      totalSwishes += 1;
    } else if (isLongRange) {
      pointsAwarded = config.longRangePoints;
      totalLongRangeBaskets += 1;
    } else {
      pointsAwarded = config.normalBasketPoints;
    }

    if (config.streakEnabled && streak % config.streakRequired === 0) {
      pointsAwarded += config.streakBonusPoints;
    }

    return {
      result: shot.result,
      touchedRim: shot.touchedRim,
      touchedBackboard: shot.touchedBackboard,
      distanceMeters: shot.distanceMeters,
      isSwish,
      isLongRange,
      streakAtShot: streak,
      pointsAwarded,
      shotAt: shot.shotAt ?? null,
    };
  });

  const totalScore = scoredShots.reduce((sum, shot) => sum + shot.pointsAwarded, 0);

  return {
    shots: scoredShots,
    totalScore,
    totalBaskets,
    totalMisses,
    totalSwishes,
    totalLongRangeBaskets,
    totalLongRangeAttempts,
    bestStreak,
    accuracy: shots.length === 0 ? 0 : Math.round((totalBaskets / shots.length) * 10000) / 10000,
  };
};
