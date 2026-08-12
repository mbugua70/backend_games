import { Router } from "express";
import * as leaderboardController from "../../controllers/leaderboard.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/leaderboard. Read-only admin reporting view
// - the public leaderboard endpoint (step 9) reuses the same
// leaderboard.service query, not a copy of it.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", leaderboardController.getLeaderboard);

export default router;
