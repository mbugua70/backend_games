import { Router } from "express";
import * as brandController from "../../controllers/brand.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", brandController.list);
router.post("/", brandController.create);
router.patch("/:brandId", brandController.update);

export default router;
