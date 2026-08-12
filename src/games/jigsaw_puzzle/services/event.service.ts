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

const assertCodeAvailable = async (code: string, excludeId?: string): Promise<void> => {
  const existing = await Event.findOne({
    code,
    ...(excludeId && { _id: { $ne: excludeId } }),
  });
  if (existing) {
    throw new AppError(`Event code "${code}" is already in use`, 409);
  }
};

export const createEvent = async (input: EventInput): Promise<EventPayload> => {
  await assertCodeAvailable(input.code);

  const event = await Event.create({
    name: input.name,
    code: input.code,
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: input.isActive ?? true,
  });

  return toEventPayload(event);
};

export const listEvents = async (): Promise<EventPayload[]> => {
  const events = await Event.find().sort({ createdAt: -1 });
  return events.map(toEventPayload);
};

export const getEventById = async (id: string): Promise<EventPayload> => {
  const event = await Event.findById(id);
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};

export const updateEvent = async (
  id: string,
  input: Partial<EventInput>
): Promise<EventPayload> => {
  if (input.code) {
    await assertCodeAvailable(input.code, id);
  }

  const event = await Event.findByIdAndUpdate(id, input, { new: true });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return toEventPayload(event);
};

// Deletes only the Event document - GameConfig/Players/GameSessions that
// reference it are left as-is (no cascade), so historical session data for
// an event is never silently wiped out by managing that event.
export const deleteEvent = async (id: string): Promise<void> => {
  const event = await Event.findByIdAndDelete(id);
  if (!event) {
    throw new AppError("Event not found", 404);
  }
};
