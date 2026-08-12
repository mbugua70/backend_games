import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as eventService from "../services/event.service";
import {
  createEventSchema,
  eventIdParamSchema,
  updateEventSchema,
} from "../validators/event.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const createEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = createEventSchema.parse(req.body);
    const event = await eventService.createEvent(adminOf(res).organizationId, input);
    sendSuccess(res, event, "Event created", 201);
  }
);

export const listEvents = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const events = await eventService.listEvents(adminOf(res).organizationId);
    sendSuccess(res, events);
  }
);

export const getEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = eventIdParamSchema.parse(req.params);
    const event = await eventService.getEventById(adminOf(res).organizationId, id);
    sendSuccess(res, event);
  }
);

export const updateEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = eventIdParamSchema.parse(req.params);
    const input = updateEventSchema.parse(req.body);
    const event = await eventService.updateEvent(adminOf(res).organizationId, id, input);
    sendSuccess(res, event, "Event updated");
  }
);

export const deleteEvent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = eventIdParamSchema.parse(req.params);
    await eventService.deleteEvent(adminOf(res).organizationId, id);
    sendSuccess(res, { id }, "Event deleted");
  }
);
