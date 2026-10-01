import { AppError } from "../../../core/utils/AppError";
import { Event, EventDocument, EventStatus, GiftPoolMode } from "../models/Event";

export interface EventPayload {
  id: string;
  name: string;
  code: string;
  status: EventStatus;
  giftPoolMode: GiftPoolMode;
  registrationEnabled: boolean;
  configVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const toEventPayload = (event: EventDocument): EventPayload => ({
  id: event._id.toString(),
  name: event.name,
  code: event.code,
  status: event.status,
  giftPoolMode: event.giftPoolMode,
  registrationEnabled: event.registrationEnabled,
  configVersion: event.configVersion,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

export interface CreateEventInput {
  name: string;
  code: string;
  registrationEnabled?: boolean;
}

export const createEvent = async (
  organizationId: string,
  input: CreateEventInput
): Promise<EventPayload> => {
  const event = await Event.create({
    organizationId,
    name: input.name,
    code: input.code,
    registrationEnabled: input.registrationEnabled ?? false,
  });
  return toEventPayload(event);
};

export const listEvents = async (organizationId: string): Promise<EventPayload[]> => {
  const events = await Event.find({ organizationId }).sort({ createdAt: -1 });
  return events.map(toEventPayload);
};

export const getEvent = async (organizationId: string, eventId: string): Promise<EventPayload> => {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};

export interface UpdateEventInput {
  name?: string;
  status?: EventStatus;
  registrationEnabled?: boolean;
}

export const updateEvent = async (
  organizationId: string,
  eventId: string,
  input: UpdateEventInput
): Promise<EventPayload> => {
  const event = await Event.findOneAndUpdate(
    { _id: eventId, organizationId },
    { $set: input, $inc: { configVersion: 1 } },
    { new: true }
  );
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};

// Switching shared/perBrand never touches GiftPool documents - both kinds
// persist regardless of which one gameConfig/wins currently resolve to
// (see services/giftPool.service.ts).
export const switchGiftPoolMode = async (
  organizationId: string,
  eventId: string,
  giftPoolMode: GiftPoolMode
): Promise<EventPayload> => {
  const event = await Event.findOneAndUpdate(
    { _id: eventId, organizationId },
    { $set: { giftPoolMode }, $inc: { configVersion: 1 } },
    { new: true }
  );
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};
