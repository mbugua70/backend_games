import { z } from "zod";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Shared by both the paginated list and the unpaginated CSV export - same
// filters, same result set, just export skips the page/limit slicing.
const baseFilterSchema = z.object({
  date: z.string().regex(DATE_RE, "date must be YYYY-MM-DD").optional(),
  q: z.string().trim().min(1).max(80).optional(),
  sortBy: z.enum(["score", "date"]).default("score"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// REST: GET /api/admin/reports/players
export const listScoresQuerySchema = baseFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

// REST: GET /api/admin/reports/export
export const exportScoresQuerySchema = baseFilterSchema;

export type ScoreFilters = z.infer<typeof baseFilterSchema>;
export type ListScoresQuery = z.infer<typeof listScoresQuerySchema>;
