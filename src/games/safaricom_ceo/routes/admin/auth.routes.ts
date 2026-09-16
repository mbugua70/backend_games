import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../../../core/config/env";
import * as authController from "../../controllers/auth.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: env.SAFARICOM_CEO_LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: env.SAFARICOM_CEO_LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .json({ success: false, message: "Too many login attempts, please try again later" });
  },
});

router.post("/login", loginLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.get("/me", requireAdmin, authController.me);
router.post("/logout", requireAdmin, authController.logout);

export default router;
