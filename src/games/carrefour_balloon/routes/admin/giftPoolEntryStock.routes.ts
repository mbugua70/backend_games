import { Router } from "express";
import * as giftPoolEntryController from "../../controllers/giftPoolEntry.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Mounted at /events/:eventId/gift-pool-entries - deliberately a sibling of
// /gift-pools, not nested under a specific pool, since the entry id alone
// already determines its pool (see services/giftPoolEntry.service.ts's
// getEntryOwnedByEvent).
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.post("/:entryId/stock", giftPoolEntryController.adjustStock);

export default router;
