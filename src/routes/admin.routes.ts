import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as adminController from "../controllers/admin.controller";
import { requireAdmin } from "../middleware/requireAdmin";

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;

// Tighter than the app-wide rate limit in app.ts - this endpoint gates
// access to every player's data, on a network the public booth is on.
const loginRateLimit = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts, please try again later",
    });
  },
});

const router = Router();

router.post("/login", loginRateLimit, adminController.login);
router.get("/me", requireAdmin, adminController.me);

export default router;
