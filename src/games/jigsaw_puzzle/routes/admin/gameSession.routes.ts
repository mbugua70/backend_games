import { Router } from "express";
import * as gameSessionController from "../../controllers/gameSession.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/sessions - read-only. Sessions are created
// and completed by the public game endpoints (step 9), not by admins.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", gameSessionController.listSessions);
router.get("/:sessionId", gameSessionController.getSession);

export default router;
