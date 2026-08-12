import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.use(requireAdmin);
router.get("/players", reportController.list);
router.get("/summary", reportController.summary);
router.get("/export", reportController.exportCsv);

export default router;
