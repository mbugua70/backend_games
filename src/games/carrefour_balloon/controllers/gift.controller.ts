import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as giftService from "../services/gift.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventAndGiftIdParamSchema, eventIdParamSchema } from "../validators/common.validator";
import { createGiftSchema, listGiftsQuerySchema, updateGiftSchema } from "../validators/gift.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const { includeArchived } = listGiftsQuerySchema.parse(req.query);
  const gifts = await giftService.listGifts(orgId(res), eventId, includeArchived);
  sendSuccess(res, gifts);
});

export const create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = createGiftSchema.parse(req.body);
  const gift = await giftService.createGift(orgId(res), eventId, input);
  sendSuccess(res, gift, "Gift created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, giftId } = eventAndGiftIdParamSchema.parse(req.params);
  const input = updateGiftSchema.parse(req.body);
  const gift = await giftService.updateGift(orgId(res), eventId, giftId, input);
  sendSuccess(res, gift, "Gift updated");
});

export const archive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId, giftId } = eventAndGiftIdParamSchema.parse(req.params);
  const gift = await giftService.archiveGift(orgId(res), eventId, giftId);
  sendSuccess(res, gift, "Gift archived");
});
