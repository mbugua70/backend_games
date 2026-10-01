import { Router } from "express";
import * as giftPoolController from "../../controllers/giftPool.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", giftPoolController.list);
router.post("/", giftPoolController.create);
router.patch("/:poolId", giftPoolController.update);

export default router;
