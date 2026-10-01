import { AppError } from "../../../core/utils/AppError";
import { Event, EventDocument } from "../models/Event";

// Shared by every admin service whose data hangs off an Event (brands,
// gift pools, gifts, registration config, wins, stats): confirms the event
// exists AND belongs to the caller's organization before that data is read
// or written, so an admin can never touch another org's event by guessing
// an id.
export const assertEventOwnedByOrg = async (
  organizationId: string,
  eventId: string
): Promise<EventDocument> => {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
  return event;
};

export const bumpConfigVersion = async (eventId: string): Promise<void> => {
  await Event.updateOne({ _id: eventId }, { $inc: { configVersion: 1 } });
};
