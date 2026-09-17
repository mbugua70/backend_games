import { Dimension, DIMENSIONS } from "../models/Question";
import { ScoringSummary } from "./scoring.service";

export interface ProfileResolutionInput extends ScoringSummary {
  organizationId: string;
}

export interface NextFrontierEntry {
  dimension: Dimension;
  explanation: string;
}

export interface ProfileResolutionResult {
  // The Profile.code to attach to the SessionResult, or null.
  profileCode: string | null;
  strengths: Dimension[];
  nextFrontier: NextFrontierEntry[];
  ceoQuestion: string | null;
  // Lets callers (e.g. the GET .../result response) label the result as
  // provisional in the API/UI without guessing from profileCode being null.
  isPlaceholder: boolean;
}

export interface ProfileResolver {
  resolve(
    input: ProfileResolutionInput
  ): ProfileResolutionResult | Promise<ProfileResolutionResult>;
}

// First draft of the scoring-pattern -> profile rule, sourced from
// 60_Second_CEO_Challenge_Agency_Brief.docx section 9 ("BUILD 4-5 CEO
// PROFILES") rather than invented here - the brief names these exact 5
// profiles and one-line descriptions, but explicitly leaves the precise
// scoring pattern for each as "Agency to develop... based on scoring
// patterns." The FUTURE_READY_ENTERPRISE threshold and the VISIBILITY/
// EFFICIENCY -> FOUNDATION_BUILDER grouping below are this file's own
// interpretation of that open brief, not approved business logic - flag
// for review before this ships to a real event. See seedContent.ts for
// the matching Profile name/description text.
const PROFILE_CODES = {
  FOUNDATION_BUILDER: "FOUNDATION_BUILDER",
  CONNECTED_OPERATOR: "CONNECTED_OPERATOR",
  INTELLIGENT_GROWTH_BUILDER: "INTELLIGENT_GROWTH_BUILDER",
  RESILIENCE_LEADER: "RESILIENCE_LEADER",
  FUTURE_READY_ENTERPRISE: "FUTURE_READY_ENTERPRISE",
} as const;

// A CEO scoring at or above this average (across all 5 dimensions) reads as
// "strong everywhere" rather than "strong in one specific area" - the brief's
// own placeholder example for this exact rule ("average >= 4.5").
const FUTURE_READY_AVERAGE_THRESHOLD = 4.5;

// Per-dimension "next frontier" explanation + CEO question copy. Drafted in
// the brief's voice/tone (business language, not technical, not judgemental)
// and modeled directly on the one full example the brief itself gives for
// RESILIENCE - the other 4 are this file's own extrapolation and need the
// same creative sign-off as the profile descriptions before going live.
const NEXT_FRONTIER_COPY: Record<Dimension, { explanation: string; ceoQuestion: string }> = {
  VISIBILITY: {
    explanation:
      "As a business grows, the gap between what's happening and what you can actually see tends to widen - and that gap is where surprises live.",
    ceoQuestion: "What would you catch sooner if you could see your whole business at once?",
  },
  EFFICIENCY: {
    explanation:
      "The more the business scales, the more manual work quietly becomes the ceiling on how fast it can grow.",
    ceoQuestion:
      "What would become possible if your best people stopped doing your business's busywork?",
  },
  CONNECTEDNESS: {
    explanation:
      "As people, locations and systems multiply, disconnected pieces slow down exactly the decisions that need to move fastest.",
    ceoQuestion:
      "What decision took longer than it should have, simply because two parts of your business weren't talking to each other?",
  },
  RESILIENCE: {
    // The brief's own example, verbatim (section 9).
    explanation:
      "As your footprint grows, the ability to anticipate disruption and keep the business moving becomes increasingly important.",
    ceoQuestion: "What would become possible if your business could see disruption before it felt it?",
  },
  INTELLIGENCE: {
    explanation:
      "The businesses that grow fastest aren't the ones with the most data - they're the ones that turn it into decisions before instinct has to guess.",
    ceoQuestion:
      "What's the last big decision you made on instinct that you wish you'd had the data for?",
  },
};

// strongest/weakest from scoring.service.ts are ordered by when that
// dimension's question was answered, not by a fixed dimension order - pick
// deterministically off the canonical DIMENSIONS order instead, so the
// result doesn't depend on question ordering.
const primaryDimension = (dimensions: Dimension[]): Dimension =>
  DIMENSIONS.find((d) => dimensions.includes(d)) ?? dimensions[0]!;

const resolveProfileCode = (input: ProfileResolutionInput): string => {
  if (input.average >= FUTURE_READY_AVERAGE_THRESHOLD) {
    return PROFILE_CODES.FUTURE_READY_ENTERPRISE;
  }

  switch (primaryDimension(input.strongest)) {
    case "CONNECTEDNESS":
      return PROFILE_CODES.CONNECTED_OPERATOR;
    case "INTELLIGENCE":
      return PROFILE_CODES.INTELLIGENT_GROWTH_BUILDER;
    case "RESILIENCE":
      return PROFILE_CODES.RESILIENCE_LEADER;
    case "VISIBILITY":
    case "EFFICIENCY":
    default:
      return PROFILE_CODES.FOUNDATION_BUILDER;
  }
};

export class DimensionPatternProfileResolver implements ProfileResolver {
  resolve(input: ProfileResolutionInput): ProfileResolutionResult {
    return {
      profileCode: resolveProfileCode(input),
      strengths: input.strongest,
      nextFrontier: input.weakest.map((dimension) => ({
        dimension,
        explanation: NEXT_FRONTIER_COPY[dimension].explanation,
      })),
      ceoQuestion: NEXT_FRONTIER_COPY[primaryDimension(input.weakest)].ceoQuestion,
      isPlaceholder: false,
    };
  }
}

export const getProfileResolver = (): ProfileResolver => new DimensionPatternProfileResolver();
