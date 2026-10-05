import { Router } from "express";
import * as adminController from "../../controllers/admin.controller";
import { requireAdmin } from "../../middleware/requireAdmin";
import { requireRole } from "../../middleware/requireRole";

// Game config and results - everything admin-facing except auth and
// questions, which have their own routers.
const router = Router();
router.use(requireAdmin);

router.get("/config", adminController.getConfig);
router.patch("/config", requireRole("SUPER_ADMIN"), adminController.updateConfig);
router.get("/players", adminController.listPlayers);
router.get("/leaderboard", adminController.leaderboard);

export default router;
