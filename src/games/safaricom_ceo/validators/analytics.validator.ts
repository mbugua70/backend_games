import { z } from "zod";

export const analyticsSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  businessType: z.string().trim().min(1).max(100).optional(),
  // Profile code (case-insensitive - normalized against Profile.code, which
  // is stored uppercased).
  profile: z.string().trim().min(1).max(50).optional(),
});

export type AnalyticsSummaryQuery = z.infer<typeof analyticsSummaryQuerySchema>;
