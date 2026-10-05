import { Router } from "express";
import * as questionController from "../../controllers/question.controller";
import { requireAdmin } from "../../middleware/requireAdmin";
import { requireRole } from "../../middleware/requireRole";

const router = Router();
router.use(requireAdmin);

router.get("/", questionController.list);
router.get("/:questionId", questionController.getOne);
// Changing what the game plays is SUPER_ADMIN-only; a plain ADMIN can
// view questions and results.
router.post("/", requireRole("SUPER_ADMIN"), questionController.create);
router.post("/bulk", requireRole("SUPER_ADMIN"), questionController.bulkCreate);
router.patch("/:questionId", requireRole("SUPER_ADMIN"), questionController.update);
router.delete("/:questionId", requireRole("SUPER_ADMIN"), questionController.deactivate);

export default router;
