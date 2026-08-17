import { z } from "zod";

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

const assertUniqueKeys = (fields: { key: string }[], ctx: z.RefinementCtx): void => {
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.key)) {
      ctx.addIssue({ code: "custom", path: ["fields"], message: `Duplicate key "${field.key}"` });
    }
    seen.add(field.key);
  }
};

export const registrationConfigSchema = z
  .object({
    playerMode: z.enum(["guest", "registered"]),
    fields: z.array(registrationFieldSchema).default([]),
    phoneFieldKey: z.string().trim().min(1).nullable().optional(),
    nameFieldKey: z.string().trim().min(1).nullable().optional(),
  })
  .superRefine((config, ctx) => {
    assertUniqueKeys(config.fields, ctx);
    if (config.phoneFieldKey) {
      const field = config.fields.find((candidate) => candidate.key === config.phoneFieldKey);
      if (!field || field.type !== "phone") {
        ctx.addIssue({
          code: "custom",
          path: ["phoneFieldKey"],
          message: 'phoneFieldKey must reference a field of type "phone"',
        });
      }
    }
    if (
      config.nameFieldKey &&
      !config.fields.some((field) => field.key === config.nameFieldKey)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["nameFieldKey"],
        message: "nameFieldKey must reference a known registration field",
      });
    }
  });

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});
