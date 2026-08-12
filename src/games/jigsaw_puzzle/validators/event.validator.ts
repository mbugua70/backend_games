import { z } from "zod";

const endsAfterStart = (
  data: { startDate?: Date; endDate?: Date },
  ctx: z.RefinementCtx
): void => {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be on or after startDate",
    });
  }
};

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1),
    code: z.string().trim().min(1).toLowerCase(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isActive: z.boolean().optional(),
  })
  .superRefine(endsAfterStart);

export const updateEventSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).toLowerCase().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine(endsAfterStart);

export const eventIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});
