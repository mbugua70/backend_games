import { Router } from "express";
import * as giftPoolEntryController from "../../controllers/giftPoolEntry.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

// Mounted at /events/:eventId/gift-pools/:poolId/entries.
const router = Router({ mergeParams: true });

router.use(requireAdmin);

router.get("/", giftPoolEntryController.list);
router.post("/", giftPoolEntryController.create);
router.patch("/:entryId", giftPoolEntryController.update);

export default router;
