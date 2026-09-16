import { Router } from "express";
import * as adminSessionController from "../../controllers/adminSession.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();
router.use(requireAdmin);

router.get("/", adminSessionController.list);
router.get("/:sessionId", adminSessionController.getOne);

export default router;
