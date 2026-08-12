import { Router } from "express";
import * as eventController from "../../controllers/event.controller";

// TODO(step 10): gate this router with requireAdmin once admin auth is
// reconciled with the Event entity (see games/jigsaw_puzzle/models/Admin.ts).
// Wide open until then - dev-only, not deployed.
const router = Router();

router.post("/", eventController.createEvent);
router.get("/", eventController.listEvents);
router.get("/:id", eventController.getEvent);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

export default router;
