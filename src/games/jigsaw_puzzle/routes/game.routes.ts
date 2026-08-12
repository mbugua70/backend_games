import { Router } from "express";
import * as gameController from "../controllers/game.controller";

const router = Router();

router.post("/", gameController.createSession);
router.get("/:gameCode", gameController.getSession);
router.delete("/:gameCode", gameController.deleteSession);

export default router;
