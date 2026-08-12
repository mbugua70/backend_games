import { AppError } from "../../../core/utils/AppError";
import { DifficultySnapshot, GameSession, GameSessionDocument, GameSessionStatus } from "../models/GameSession";
import { Event } from "../models/Event";

export interface GameSessionPayload {
  id: string;
  uuid: string;
  eventId: string;
  playerId: string | null;
  difficulty: DifficultySnapshot;
  status: GameSessionStatus;
  moves: number;
  hintsUsed: number;
  score: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const toGameSessionPayload = (session: GameSessionDocument): GameSessionPayload => ({
  id: session._id.toString(),
  uuid: session.uuid,
  eventId: session.eventId.toString(),
  playerId: session.playerId ? session.playerId.toString() : null,
  difficulty: session.difficulty,
  status: session.status,
  moves: session.moves,
  hintsUsed: session.hintsUsed,
  score: session.score,
  completedAt: session.completedAt,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

// Same isolation guarantee as event/gameConfig/player services: confirm the
// event belongs to this admin's organization before any of its session data
// is read.
const assertEventOwnedByOrg = async (organizationId: string, eventId: string): Promise<void> => {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) {
    throw new AppError("Event not found", 404);
  }
};

export const listSessionsByEvent = async (
  organizationId: string,
  eventId: string
): Promise<GameSessionPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const sessions = await GameSession.find({ eventId }).sort({ createdAt: -1 });
  return sessions.map(toGameSessionPayload);
};

export const getSessionById = async (
  organizationId: string,
  eventId: string,
  sessionId: string
): Promise<GameSessionPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);

  const session = await GameSession.findOne({ _id: sessionId, eventId });
  if (!session) {
    throw new AppError("Game session not found", 404);
  }
  return toGameSessionPayload(session);
};
