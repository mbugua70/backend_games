import { Router } from "express";
import * as registrationConfigController from "../../controllers/registrationConfig.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", registrationConfigController.getOne);
router.put("/", registrationConfigController.upsert);

export default router;
