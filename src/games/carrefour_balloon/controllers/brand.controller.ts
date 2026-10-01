import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as brandService from "../services/brand.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventAndBrandIdParamSchema, eventIdParamSchema } from "../validators/common.validator";
import { createBrandSchema, updateBrandSchema } from "../validators/brand.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const brands = await brandService.listBrands(orgId(res), eventId);
  sendSuccess(res, brands);
});

export const create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = createBrandSchema.parse(req.body);
  const brand = await brandService.createBrand(orgId(res), eventId, input);
  sendSuccess(res, brand, "Brand created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, brandId } = eventAndBrandIdParamSchema.parse(req.params);
  const input = updateBrandSchema.parse(req.body);
  const brand = await brandService.updateBrand(orgId(res), eventId, brandId, input);
  sendSuccess(res, brand, "Brand updated");
});
