import { Router } from "express";
import * as profileController from "../../controllers/profile.controller";
import { requireAdmin } from "../../middleware/requireAdmin";
import { requireRole } from "../../middleware/requireRole";

const router = Router();
router.use(requireAdmin);

router.get("/", profileController.list);
router.post("/", requireRole("SUPER_ADMIN"), profileController.create);
router.patch("/:profileId", requireRole("SUPER_ADMIN"), profileController.update);

export default router;
