// Must stay in sync with tug_war's src/data/pillars.js ids.
export const TUGWAR_PILLARS = ["customer", "growth", "simplicity", "purpose"] as const;
export type TugWarPillar = (typeof TUGWAR_PILLARS)[number];

export const TUGWAR_SIDES = ["left", "right"] as const;
export type TugWarSide = (typeof TUGWAR_SIDES)[number];

export const TUGWAR_WINNERS = ["left", "right", "draw"] as const;
export type TugWarWinner = (typeof TUGWAR_WINNERS)[number];

export const TUGWAR_MATCH_STATUSES = ["in_progress", "finished"] as const;
export type TugWarMatchStatus = (typeof TUGWAR_MATCH_STATUSES)[number];

export interface TugWarPlayerInput {
  name: string;
  pillar: TugWarPillar;
}
