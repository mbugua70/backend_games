import { Router } from "express";
import * as playerController from "../../controllers/player.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/players - read-only. Players are created by
// the public self-registration endpoint (step 9), not by admins.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", playerController.listPlayers);
router.get("/:playerId", playerController.getPlayer);

export default router;
