import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as eventService from "../services/event.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventIdParamSchema } from "../validators/common.validator";
import { createEventSchema, switchGiftPoolModeSchema, updateEventSchema } from "../validators/event.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = createEventSchema.parse(req.body);
  const event = await eventService.createEvent(orgId(res), input);
  sendSuccess(res, event, "Event created", 201);
});

export const list = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const events = await eventService.listEvents(orgId(res));
  sendSuccess(res, events);
});

export const getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const event = await eventService.getEvent(orgId(res), eventId);
  sendSuccess(res, event);
});

export const update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = updateEventSchema.parse(req.body);
  const event = await eventService.updateEvent(orgId(res), eventId, input);
  sendSuccess(res, event, "Event updated");
});

export const switchGiftPoolMode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const { giftPoolMode } = switchGiftPoolModeSchema.parse(req.body);
  const event = await eventService.switchGiftPoolMode(orgId(res), eventId, giftPoolMode);
  sendSuccess(res, event, "Gift pool mode updated");
});
