import { z } from "zod";

const messagesSchema = z
  .object({
    win: z.string().trim().nullable().optional(),
    lose: z.string().trim().nullable().optional(),
    unavailable: z.string().trim().nullable().optional(),
  })
  .optional();

export const createPoolSchema = z.object({
  brandId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid brand id")
    .nullable()
    .optional(),
  balloonCount: z.number().int().positive(),
  guaranteedNoGiftBalloonCount: z.number().int().min(0),
  maxPopsPerRound: z.number().int().positive(),
  maxWinsPerRound: z.number().int().min(0),
  messages: messagesSchema,
});

export const updatePoolSchema = z.object({
  balloonCount: z.number().int().positive().optional(),
  guaranteedNoGiftBalloonCount: z.number().int().min(0).optional(),
  maxPopsPerRound: z.number().int().positive().optional(),
  maxWinsPerRound: z.number().int().min(0).optional(),
  messages: messagesSchema,
});
