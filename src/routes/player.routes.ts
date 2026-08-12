import { Router } from "express";
import * as playerController from "../controllers/player.controller";

const router = Router();

router.post("/login", playerController.login);

export default router;
