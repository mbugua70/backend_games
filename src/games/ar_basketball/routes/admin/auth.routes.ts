import { Router } from "express";
import * as authController from "../../controllers/auth.controller";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();

router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.get("/me", requireAdmin, authController.me);

export default router;
