import { Router } from "express";
import * as scoreController from "../controllers/score.controller";

const router = Router();

router.post("/submit", scoreController.submit);

export default router;
