import { z } from "zod";

export const eventBrandingSchema = z.object({
  logoUrl: z.string().trim().url().nullable().optional(),
  primaryColor: z.string().trim().min(1).nullable().optional(),
  secondaryColor: z.string().trim().min(1).nullable().optional(),
  backgroundImageUrl: z.string().trim().url().nullable().optional(),
  sponsorLogoUrls: z.array(z.string().trim().url()).optional(),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
});
