import { Router } from "express";
import * as tugwarController from "../controllers/tugwar.controller";

const router = Router();

router.post("/start", tugwarController.start);
router.post("/:sessionId/finish", tugwarController.finish);

export default router;
