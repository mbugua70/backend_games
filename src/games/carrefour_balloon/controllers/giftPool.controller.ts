import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as giftPoolService from "../services/giftPool.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventAndPoolIdParamSchema, eventIdParamSchema } from "../validators/common.validator";
import { createPoolSchema, updatePoolSchema } from "../validators/giftPool.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const pools = await giftPoolService.listPools(orgId(res), eventId);
  sendSuccess(res, pools);
});

export const create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = createPoolSchema.parse(req.body);
  const pool = await giftPoolService.createPool(orgId(res), eventId, {
    ...input,
    brandId: input.brandId ?? null,
  });
  sendSuccess(res, pool, "Gift pool created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, poolId } = eventAndPoolIdParamSchema.parse(req.params);
  const input = updatePoolSchema.parse(req.body);
  const pool = await giftPoolService.updatePool(orgId(res), eventId, poolId, input);
  sendSuccess(res, pool, "Gift pool updated");
});
