import { Router } from "express";
import * as giftController from "../../controllers/gift.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", giftController.list);
router.post("/", giftController.create);
router.patch("/:giftId", giftController.update);
router.post("/:giftId/archive", giftController.archive);

export default router;
