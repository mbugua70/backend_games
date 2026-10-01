import { Router } from "express";
import * as eventController from "../../controllers/event.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();

router.use(requireAdmin);

router.post("/", eventController.create);
router.get("/", eventController.list);
router.get("/:eventId", eventController.getOne);
router.patch("/:eventId", eventController.update);
router.patch("/:eventId/gift-pool-mode", eventController.switchGiftPoolMode);

export default router;
