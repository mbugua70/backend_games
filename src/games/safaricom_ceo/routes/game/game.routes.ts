import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../../../core/config/env";
import * as participantController from "../../controllers/participant.controller";
import * as publicQuestionController from "../../controllers/publicQuestion.controller";

const router = Router();

// Shared by every sensitive public endpoint in this game (registration now;
// session start/response submit/complete join in later) - limits and
// window are env-configurable so they can be loosened for a busy event
// without a code change. See env.ts's SAFARICOM_CEO_RATE_LIMIT_* vars.
const standardLimiter = rateLimit({
  windowMs: env.SAFARICOM_CEO_RATE_LIMIT_WINDOW_MS,
  limit: env.SAFARICOM_CEO_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .json({ success: false, message: "Too many requests, please try again later" });
  },
});

router.post("/participants", standardLimiter, participantController.register);
router.get("/questions", publicQuestionController.listPublic);

export default router;
