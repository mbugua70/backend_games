import { Router } from "express";
import * as eventController from "../../controllers/event.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();

router.use(requireAdmin);

router.post("/", eventController.createEvent);
router.get("/", eventController.listEvents);
router.get("/:id", eventController.getEvent);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

export default router;
