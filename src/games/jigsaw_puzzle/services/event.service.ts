import { AppError } from "../../../core/utils/AppError";
import { Event, EventDocument } from "../models/Event";

interface EventInput {
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
}

export interface EventPayload {
  id: string;
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toEventPayload = (event: EventDocument): EventPayload => ({
  id: event._id.toString(),
  name: event.name,
  code: event.code,
  startDate: event.startDate,
  endDate: event.endDate,
  isActive: event.isActive,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

// Event codes are globally unique, not per-organization: the public game
// client looks an event up by code alone (e.g. from a scanned QR code),
// with no organization context to disambiguate against.
const assertCodeAvailable = async (code: string, excludeId?: string): Promise<void> => {
  const existing = await Event.findOne({
    code,
    ...(excludeId && { _id: { $ne: excludeId } }),
  });
  if (existing) {
    throw new AppError(`Event code "${code}" is already in use`, 409);
  }
};

export const createEvent = async (
  organizationId: string,
  input: EventInput
): Promise<EventPayload> => {
  await assertCodeAvailable(input.code);

  const event = await Event.create({
    name: input.name,
    code: input.code,
    organizationId,
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: input.isActive ?? true,
  });

  return toEventPayload(event);
};

export const listEvents = async (organizationId: string): Promise<EventPayload[]> => {
  const events = await Event.find({ organizationId }).sort({ createdAt: -1 });
  return events.map(toEventPayload);
};

// Public lookup key for the game client (e.g. from a scanned QR code) - no
// organizationId filter, since the client has no admin session to scope by.
export const getEventByCode = async (code: string): Promise<EventPayload> => {
  const event = await Event.findOne({ code });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};

// Gates the public write actions (registration, starting a session) - GET
// /events/:code deliberately skips this so the client can still fetch the
// event and show a "not live" message instead of a bare 404.
export const assertEventIsLive = (event: EventDocument): void => {
  if (!event.isActive) {
    throw new AppError("This event is not currently active", 403);
  }
  const now = new Date();
  if (now < event.startDate) {
    throw new AppError("This event has not started yet", 403);
  }
  if (now > event.endDate) {
    throw new AppError("This event has ended", 403);
  }
};

export const getEventById = async (
  organizationId: string,
  id: string
): Promise<EventPayload> => {
  const event = await Event.findOne({ _id: id, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};

export const updateEvent = async (
  organizationId: string,
  id: string,
  input: Partial<EventInput>
): Promise<EventPayload> => {
  if (input.code) {
    await assertCodeAvailable(input.code, id);
  }

  const event = await Event.findOneAndUpdate({ _id: id, organizationId }, input, {
    new: true,
  });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};

// Deletes only the Event document - GameConfig/Players/GameSessions that
// reference it are left as-is (no cascade), so historical session data for
// an event is never silently wiped out by managing that event.
export const deleteEvent = async (organizationId: string, id: string): Promise<void> => {
  const event = await Event.findOneAndDelete({ _id: id, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
};
