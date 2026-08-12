import { Request, Response } from "express";
import * as reportService from "../services/report.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/response";
import { exportScoresQuerySchema, listScoresQuerySchema } from "../validators/report.validator";

export const list = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = listScoresQuerySchema.parse(req.query);
    const result = await reportService.listScores(query);
    sendSuccess(res, result);
  }
);

export const summary = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const result = await reportService.getSummary();
    sendSuccess(res, result);
  }
);

export const exportCsv = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filters = exportScoresQuerySchema.parse(req.query);
    const csv = await reportService.exportScoresCsv(filters);

    const filenameSuffix = filters.date ?? "all";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="players-${filenameSuffix}.csv"`);
    res.status(200).send(csv);
  }
);
