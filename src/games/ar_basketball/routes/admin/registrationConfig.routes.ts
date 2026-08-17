import { Router } from "express";
import * as registrationConfigController from "../../controllers/registrationConfig.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Nested under /events/:eventId/registration-config since a
// RegistrationConfig is 1:1 with an Event, not an independently
// addressable resource.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.post("/", registrationConfigController.createRegistrationConfig);
router.get("/", registrationConfigController.getRegistrationConfig);
router.put("/", registrationConfigController.updateRegistrationConfig);

export default router;
