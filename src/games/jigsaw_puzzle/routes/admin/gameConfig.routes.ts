import { Router } from "express";
import * as gameConfigController from "../../controllers/gameConfig.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/config since a GameConfig is 1:1 with an
// Event, not an independently addressable resource.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.post("/", gameConfigController.createGameConfig);
router.get("/", gameConfigController.getGameConfig);
router.put("/", gameConfigController.updateGameConfig);

export default router;
