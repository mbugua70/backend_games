import { z } from "zod";
import { SESSION_STATUSES } from "../models/Session";

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(SESSION_STATUSES).optional(),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
