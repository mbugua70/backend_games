import { Role } from "../types/game.types";

interface PresenceEntry {
  display: Set<string>;
  facilitator: Set<string>;
}

const registry = new Map<string, PresenceEntry>();

const getEntry = (gameCode: string): PresenceEntry => {
  let entry = registry.get(gameCode);
  if (!entry) {
    entry = { display: new Set(), facilitator: new Set() };
    registry.set(gameCode, entry);
  }
  return entry;
};

export const addConnection = (
  gameCode: string,
  role: Role,
  socketId: string
): void => {
  getEntry(gameCode)[role].add(socketId);
};

/** Returns true if no sockets of that role remain connected for the game. */
export const removeConnection = (
  gameCode: string,
  role: Role,
  socketId: string
): boolean => {
  const entry = registry.get(gameCode);
  if (!entry) {
    return true;
  }

  entry[role].delete(socketId);
  const roleIsEmpty = entry[role].size === 0;

  if (entry.display.size === 0 && entry.facilitator.size === 0) {
    registry.delete(gameCode);
  }

  return roleIsEmpty;
};
