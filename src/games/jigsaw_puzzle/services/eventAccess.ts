import { AppError } from "../../../core/utils/AppError";
import { Event } from "../models/Event";

// Shared by every service whose data hangs off an Event (gameConfig,
// player, gameSession, leaderboard): confirms the event exists AND belongs
// to the caller's organization before that data is read or written, so an
// admin can never touch another org's event by guessing an id.
export const assertEventOwnedByOrg = async (
  organizationId: string,
  eventId: string
): Promise<void> => {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
};
