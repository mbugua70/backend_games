import { Router } from "express";
import * as statsController from "../../controllers/stats.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", statsController.getOne);

export default router;
