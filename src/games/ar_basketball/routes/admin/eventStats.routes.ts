import { Router } from "express";
import * as eventStatsController from "../../controllers/eventStats.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/stats. Read-only, always computed live from
// Player/GameSession - there is no separate stats collection to drift.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", eventStatsController.getStats);

export default router;
