import { Router } from "express";
import * as leaderboardConfigController from "../../controllers/leaderboardConfig.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/leaderboard-config since a
// LeaderboardConfig is 1:1 with an Event, not an independently addressable
// resource.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.post("/", leaderboardConfigController.createLeaderboardConfig);
router.get("/", leaderboardConfigController.getLeaderboardConfig);
router.put("/", leaderboardConfigController.updateLeaderboardConfig);

export default router;
