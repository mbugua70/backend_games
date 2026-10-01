import { Router } from "express";
import * as stockAdjustmentController from "../../controllers/stockAdjustment.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", stockAdjustmentController.list);

export default router;
