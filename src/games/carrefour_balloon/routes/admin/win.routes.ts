import { Router } from "express";
import * as adminWinController from "../../controllers/adminWin.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", adminWinController.list);
router.patch("/:winId/claim", adminWinController.claim);

export default router;
