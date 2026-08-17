import { Router } from "express";
import * as publicEventController from "../../controllers/publicEvent.controller";
import * as publicGameSessionController from "../../controllers/publicGameSession.controller";
import * as publicLeaderboardController from "../../controllers/publicLeaderboard.controller";
import * as publicPlayerController from "../../controllers/publicPlayer.controller";

// Public mobile-client endpoints - no requireAdmin, scoped by an event's
// public code (or a session's sessionUuid) rather than organizationId.
// Every handler here delegates to the same services/*.ts the admin routes
// use, never a parallel copy of the logic.
const router = Router();

router.get("/events/:code", publicEventController.getEvent);
router.post("/events/:code/players", publicPlayerController.registerPlayer);
router.post("/events/:code/sessions", publicGameSessionController.startSession);
router.post("/sessions/:sessionUuid/complete", publicGameSessionController.completeSession);
router.get("/events/:code/leaderboard", publicLeaderboardController.getLeaderboard);

export default router;
