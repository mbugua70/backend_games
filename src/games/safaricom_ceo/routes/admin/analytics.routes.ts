import { Router } from "express";
import * as analyticsController from "../../controllers/analytics.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();
router.use(requireAdmin);

router.get("/summary", analyticsController.summary);

export default router;
