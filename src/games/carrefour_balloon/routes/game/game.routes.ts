import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../../../core/config/env";
import * as gameConfigController from "../../controllers/gameConfig.controller";
import * as participantController from "../../controllers/participant.controller";
import * as winController from "../../controllers/win.controller";

const router = Router();

// Shared by every sensitive public endpoint in this game (registration,
// win recording) - limits/window are env-configurable so they can be
// loosened for a busy event without a code change.
const standardLimiter = rateLimit({
  windowMs: env.CARREFOUR_BALLOON_RATE_LIMIT_WINDOW_MS,
  limit: env.CARREFOUR_BALLOON_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: "Too many requests, please try again later" });
  },
});

router.get("/events/:eventId/game-config", gameConfigController.getOne);
router.post("/events/:eventId/participants", standardLimiter, participantController.register);
router.post("/events/:eventId/wins", standardLimiter, winController.record);

export default router;
