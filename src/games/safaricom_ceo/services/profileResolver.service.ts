import { Dimension } from "../models/Question";
import { ScoringSummary } from "./scoring.service";

export interface ProfileResolutionInput extends ScoringSummary {
  organizationId: string;
}

export interface ProfileResolutionResult {
  // The Profile.code to attach to the SessionResult, or null. See the
  // module doc comment below for why this is null today.
  profileCode: string | null;
  strengths: Dimension[];
  nextFrontier: Dimension[];
  ceoQuestion: string | null;
  // Lets callers (e.g. the GET .../result response) label the result as
  // provisional in the API/UI without guessing from profileCode being null.
  isPlaceholder: boolean;
}

/**
 * Maps a completed session's scores to a business-facing profile.
 *
 * UNRESOLVED BUSINESS RULE - do not hardcode thresholds here.
 *
 * The client has not yet approved any rule for turning dimension scores
 * into one of the five seeded Profiles (e.g. "average >= 4.5 = Future-Ready
 * Enterprise", "highest dimension = CONNECTEDNESS -> Connected Operator").
 * Every such rule mentioned during scoping was explicitly a placeholder
 * example, not a spec. When the client approves real rules, implement them
 * in a new class here (or a config-driven lookup against the Profile
 * collection) and swap it in via getProfileResolver() below - nothing
 * outside this file needs to change, since services/session.service.ts
 * only ever depends on the ProfileResolver interface.
 */
export interface ProfileResolver {
  resolve(
    input: ProfileResolutionInput
  ): ProfileResolutionResult | Promise<ProfileResolutionResult>;
}

// Deliberately resolves no profile yet. strengths/nextFrontier are exposed
// from day one since they need no business rule - they're just the
// strongest/weakest dimensions already computed by scoring.service.ts.
export class PlaceholderProfileResolver implements ProfileResolver {
  resolve(input: ProfileResolutionInput): ProfileResolutionResult {
    return {
      profileCode: null,
      strengths: input.strongest,
      nextFrontier: input.weakest,
      ceoQuestion: null,
      isPlaceholder: true,
    };
  }
}

export const getProfileResolver = (): ProfileResolver => new PlaceholderProfileResolver();
