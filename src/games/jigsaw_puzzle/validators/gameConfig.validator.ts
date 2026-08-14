import { z } from "zod";

const difficultyTierSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  pieceCount: z.number().int().positive(),
  timeLimitSeconds: z.number().int().positive(),
});

const registrationFieldSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    type: z.enum(["text", "email", "phone", "number", "select"]),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "select" && (!field.options || field.options.length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "select fields need at least 2 options",
      });
    }
    if (field.type !== "select" && field.options) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "options is only valid for select fields",
      });
    }
  });

const assertUniqueKeys = <T extends { key: string }>(
  items: T[],
  ctx: z.RefinementCtx,
  path: string
): void => {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.key)) {
      ctx.addIssue({ code: "custom", path: [path], message: `Duplicate key "${item.key}"` });
    }
    seen.add(item.key);
  }
};

export const gameConfigSchema = z
  .object({
    difficultyMode: z.enum(["fixed", "player_choice"]),
    difficultyTiers: z.array(difficultyTierSchema).min(1),
    defaultDifficultyKey: z.string().trim().min(1),
    registrationFields: z.array(registrationFieldSchema).default([]),
    puzzleSource: z.enum(["camera", "uploaded_image"]),
    // The backend never stores/serves the image itself - this is just a
    // label the frontend's own bundled assets resolve independently.
    puzzleImageKey: z.string().trim().min(1).nullable().default(null),
    playerMode: z.enum(["guest", "registered"]),
    timerEnabled: z.boolean(),
    hintsEnabled: z.boolean(),
    maxHints: z.number().int().min(0).default(0),
    leaderboardEnabled: z.boolean(),
    showScore: z.boolean(),
  })
  .superRefine((config, ctx) => {
    assertUniqueKeys(config.difficultyTiers, ctx, "difficultyTiers");
    assertUniqueKeys(config.registrationFields, ctx, "registrationFields");
    if (!config.difficultyTiers.some((tier) => tier.key === config.defaultDifficultyKey)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultDifficultyKey"],
        message: "defaultDifficultyKey must match one of difficultyTiers[].key",
      });
    }
    if (config.puzzleSource === "uploaded_image" && !config.puzzleImageKey) {
      ctx.addIssue({
        code: "custom",
        path: ["puzzleImageKey"],
        message: "puzzleImageKey is required when puzzleSource is \"uploaded_image\"",
      });
    }
    if (config.puzzleSource === "camera" && config.puzzleImageKey) {
      ctx.addIssue({
        code: "custom",
        path: ["puzzleImageKey"],
        message: "puzzleImageKey is only valid when puzzleSource is \"uploaded_image\"",
      });
    }
  });

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});
