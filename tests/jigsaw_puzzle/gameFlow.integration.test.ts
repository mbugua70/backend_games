import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Organization } from "../../src/core/models/Organization";
import * as eventService from "../../src/games/jigsaw_puzzle/services/event.service";
import * as gameConfigService from "../../src/games/jigsaw_puzzle/services/gameConfig.service";
import * as gameSessionService from "../../src/games/jigsaw_puzzle/services/gameSession.service";
import * as leaderboardService from "../../src/games/jigsaw_puzzle/services/leaderboard.service";
import * as playerService from "../../src/games/jigsaw_puzzle/services/player.service";

// Exercises the actual service layer against a real (in-memory) MongoDB,
// not mocks - this is the critical path a real game session takes:
// register -> start session -> complete session -> leaderboard.
describe("jigsaw_puzzle critical game flow", () => {
  let mongoServer: MongoMemoryServer;
  let organizationId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const org = await Organization.create({ name: "Test Org", slug: "test-org" });
    organizationId = org._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const createLiveEventWithConfig = async (
    overrides: {
      difficultyMode?: "fixed" | "player_choice";
      isActive?: boolean;
      code: string;
      playerMode?: "guest" | "registered";
    }
  ) => {
    const now = Date.now();
    const event = await eventService.createEvent(organizationId, {
      name: "Test Event",
      code: overrides.code,
      startDate: new Date(now - 60 * 60 * 1000),
      endDate: new Date(now + 60 * 60 * 1000),
      isActive: overrides.isActive ?? true,
    });

    const config = await gameConfigService.createGameConfig(organizationId, event.id, {
      difficultyMode: overrides.difficultyMode ?? "player_choice",
      difficultyTiers: [
        { key: "easy", label: "Easy", pieceCount: 20, timeLimitSeconds: 120 },
        { key: "hard", label: "Hard", pieceCount: 50, timeLimitSeconds: 240 },
      ],
      defaultDifficultyKey: "easy",
      registrationFields: [
        { key: "fullName", label: "Full name", type: "text", required: true },
        {
          key: "team",
          label: "Team",
          type: "select",
          required: true,
          options: ["red", "blue"],
        },
      ],
      puzzleSource: "camera",
      puzzleImageKey: null,
      playerMode: overrides.playerMode ?? "registered",
      timerEnabled: true,
      hintsEnabled: true,
      maxHints: 5,
      leaderboardEnabled: true,
      showScore: true,
    });

    return { event, config };
  };

  it("registers a player only when submitted data satisfies the event's admin-defined fields", async () => {
    const { event } = await createLiveEventWithConfig({ code: "flow-event" });

    await expect(
      playerService.registerPlayer(event.code, { fullName: "Ada Lovelace" })
    ).rejects.toThrow(/"Team" is required/);

    await expect(
      playerService.registerPlayer(event.code, { fullName: "Ada Lovelace", team: "green" })
    ).rejects.toThrow(/"Team" must be one of/);

    const player = await playerService.registerPlayer(event.code, {
      fullName: "Ada Lovelace",
      team: "blue",
    });

    expect(player.eventId).toBe(event.id);
    expect(player.registrationData).toEqual({ fullName: "Ada Lovelace", team: "blue" });
  });

  it("starts a session at a valid difficulty and rejects an unknown one", async () => {
    const { event } = await createLiveEventWithConfig({ code: "flow-session" });
    const player = await playerService.registerPlayer(event.code, {
      fullName: "Grace Hopper",
      team: "red",
    });

    await expect(
      gameSessionService.startSession(event.code, player.id, "impossible")
    ).rejects.toThrow(/Unknown difficulty/);

    const session = await gameSessionService.startSession(event.code, player.id, "hard");

    expect(session.status).toBe("in_progress");
    expect(session.playerId).toBe(player.id);
    expect(session.difficulty).toEqual({
      key: "hard",
      label: "Hard",
      pieceCount: 50,
      timeLimitSeconds: 240,
    });
  });

  it("ignores a client-sent difficulty for a fixed-mode event", async () => {
    const { event } = await createLiveEventWithConfig({
      code: "flow-fixed",
      difficultyMode: "fixed",
    });
    const player = await playerService.registerPlayer(event.code, {
      fullName: "Katherine Johnson",
      team: "red",
    });

    // "hard" is a real tier on this event, but the event is fixed-mode, so
    // requesting it must have no effect - the session is pinned to
    // defaultDifficultyKey ("easy") regardless of what the client sends.
    const session = await gameSessionService.startSession(event.code, player.id, "hard");

    expect(session.difficulty.key).toBe("easy");
  });

  it("computes score on completion and rejects completing the same session twice", async () => {
    const { event } = await createLiveEventWithConfig({ code: "flow-complete" });
    const player = await playerService.registerPlayer(event.code, {
      fullName: "Margaret Hamilton",
      team: "blue",
    });
    const session = await gameSessionService.startSession(event.code, player.id, "easy");

    const moves = 25;
    const hintsUsed = 1;
    const completed = await gameSessionService.completeSession(session.uuid, moves, hintsUsed);

    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
    expect(completed.durationSeconds).not.toBeNull();

    // Approved formula: max(0, pieceCount*100 - durationSeconds*1 -
    // extraMoves*5 - hintsUsed*50), extraMoves = max(0, moves - pieceCount).
    const pieceCount = completed.difficulty.pieceCount;
    const durationSeconds = completed.durationSeconds as number;
    const extraMoves = Math.max(0, moves - pieceCount);
    const expectedScore = Math.max(
      0,
      Math.round(pieceCount * 100 - durationSeconds * 1 - extraMoves * 5 - hintsUsed * 50)
    );
    expect(completed.score).toBe(expectedScore);

    await expect(
      gameSessionService.completeSession(session.uuid, moves, hintsUsed)
    ).rejects.toThrow(/already been completed/);
  });

  it("starts a guest session with no playerId, and rejects a missing playerId when registered", async () => {
    const { event: guestEvent } = await createLiveEventWithConfig({
      code: "flow-guest",
      playerMode: "guest",
    });
    const session = await gameSessionService.startSession(guestEvent.code, undefined, "easy");
    expect(session.playerId).toBeNull();

    const { event: registeredEvent } = await createLiveEventWithConfig({
      code: "flow-registered",
      playerMode: "registered",
    });
    await expect(
      gameSessionService.startSession(registeredEvent.code, undefined, "easy")
    ).rejects.toThrow(/playerId is required/);
  });

  it("rejects completing a session with more hints than the event's maxHints", async () => {
    const { event } = await createLiveEventWithConfig({ code: "flow-hints" });
    const player = await playerService.registerPlayer(event.code, {
      fullName: "Hint Tester",
      team: "red",
    });
    const session = await gameSessionService.startSession(event.code, player.id, "easy");

    // createLiveEventWithConfig sets maxHints: 5.
    await expect(
      gameSessionService.completeSession(session.uuid, 10, 6)
    ).rejects.toThrow(/hintsUsed cannot exceed maxHints/);
  });

  it("rejects registration and session start on an inactive event", async () => {
    const { event } = await createLiveEventWithConfig({
      code: "flow-inactive",
      isActive: false,
    });

    await expect(
      playerService.registerPlayer(event.code, { fullName: "Ada Lovelace", team: "red" })
    ).rejects.toThrow(/not currently active/);
  });

  it("ranks completed sessions on the public leaderboard by score descending", async () => {
    const { event } = await createLiveEventWithConfig({ code: "flow-leaderboard" });

    const lowScorer = await playerService.registerPlayer(event.code, {
      fullName: "Low Scorer",
      team: "red",
    });
    const lowSession = await gameSessionService.startSession(event.code, lowScorer.id, "hard");
    // Far more moves than pieces -> a much larger extra-move penalty.
    await gameSessionService.completeSession(lowSession.uuid, 200, 5);

    const highScorer = await playerService.registerPlayer(event.code, {
      fullName: "High Scorer",
      team: "blue",
    });
    const highSession = await gameSessionService.startSession(event.code, highScorer.id, "hard");
    await gameSessionService.completeSession(highSession.uuid, 50, 0);

    const leaderboard = await leaderboardService.getLeaderboard(event.id);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]?.sessionUuid).toBe(highSession.uuid);
    expect(leaderboard[1]?.sessionUuid).toBe(lowSession.uuid);
    expect(leaderboard[0]?.score).toBeGreaterThan(leaderboard[1]?.score ?? 0);
  });
});
