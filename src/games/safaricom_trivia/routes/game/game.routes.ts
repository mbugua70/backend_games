import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../../../core/config/env";
import * as gameController from "../../controllers/game.controller";
import { requirePlayer } from "../../middleware/requirePlayer";

const router = Router();

// Only on the endpoints that write. Env-configurable so it can be
// loosened for a busy event without a code change - note that a whole
// event venue may share one public IP behind its wifi.
const standardLimiter = rateLimit({
  windowMs: env.SAFARICOM_TRIVIA_RATE_LIMIT_WINDOW_MS,
  limit: env.SAFARICOM_TRIVIA_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .json({ success: false, message: "Too many requests, please try again later" });
  },
});

router.get("/config", gameController.getConfig);
router.post("/players", standardLimiter, gameController.registerPlayer);
router.post("/sessions", standardLimiter, requirePlayer, gameController.startSession);
router.post(
  "/sessions/:sessionId/submit",
  standardLimiter,
  requirePlayer,
  gameController.submitSession
);

export default router;
