import { Router } from "express";
import * as eventBrandingController from "../../controllers/eventBranding.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/branding since EventBranding is 1:1 with
// an Event, not an independently addressable resource.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.post("/", eventBrandingController.createBranding);
router.get("/", eventBrandingController.getBranding);
router.put("/", eventBrandingController.updateBranding);

export default router;
