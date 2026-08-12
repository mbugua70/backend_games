/** How long a puzzle stays active before it auto-times-out. */
export const QUESTION_DURATION_MS = 15_000;

/** Points added to the score for each correctly judged puzzle. */
export const POINTS_PER_CORRECT = 10;

/** Game code shape: uppercase letters/digits, no ambiguous 0/O/1/I. */
export const GAME_CODE_LENGTH = 6;
export const GAME_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Safety cap on collision-retry attempts when generating a game code. */
export const GAME_CODE_MAX_ATTEMPTS = 10;

/** Floor applied when resuming, in case a facilitator paused very late. */
export const MIN_RESUME_REMAINING_MS = 1_000;
