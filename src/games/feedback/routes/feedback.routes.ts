import { Router } from "express";
import * as feedbackController from "../controllers/feedback.controller";
import { requireApiKey } from "../middleware/requireApiKey";

const router = Router();

router.use(requireApiKey);

router.post("/", feedbackController.submitFeedback);
router.get("/", feedbackController.listFeedback);
router.get("/:feedbackId", feedbackController.getFeedback);
router.delete("/:feedbackId", feedbackController.deleteFeedback);

export default router;
