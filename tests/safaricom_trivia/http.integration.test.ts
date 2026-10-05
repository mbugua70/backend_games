import http from "http";
import { AddressInfo } from "net";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Organization } from "../../src/core/models/Organization";
import { Admin } from "../../src/games/safaricom_trivia/models/Admin";
import { Session } from "../../src/games/safaricom_trivia/models/Session";

interface PlayPayload {
  session: { id: string; status: string; totalTimeLimitMs: number };
  config: { questionsPerGame: number; answerColors: string[] };
  questions: { id: string; text: string; options: { id: string; text: string }[]; correctOptionId: string }[];
}

interface ResultPayload {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  scorePercent: number;
  isLate: boolean;
}

// Exercises the real Express app end to end: admin sets up questions and
// config, players register, play, and submit, admin reads results.
describe("safaricom_trivia HTTP layer", () => {
  let mongoServer: MongoMemoryServer;
  let server: http.Server;
  let baseUrl: string;
  let superAdminToken: string;
  let plainAdminToken: string;

  const PUBLIC = "/api/safaricom_trivia/v1";
  const ADMIN = "/api/admin/safaricom_trivia/v1";

  const call = async <T = unknown>(
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {}
  ): Promise<{ status: number; body: { success: boolean; message?: string; data: T } }> => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { status: res.status, body: (await res.json()) as never };
  };

  const register = (name: string, phone: string) =>
    call<{ player: { id: string; name: string }; token: string }>("POST", `${PUBLIC}/players`, {
      body: { name, phone },
    });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // Must match env.ts's default SAFARICOM_TRIVIA_ORG_SLUG.
    const org = await Organization.create({ name: "Trivia Org", slug: "safaricom-trivia" });
    const passwordHash = await bcrypt.hash("correct-horse", 10);
    await Admin.create({
      name: "Super",
      email: "super@example.com",
      passwordHash,
      role: "SUPER_ADMIN",
      organizationId: org._id,
    });
    await Admin.create({
      name: "Plain",
      email: "plain@example.com",
      passwordHash,
      role: "ADMIN",
      organizationId: org._id,
    });

    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    const login = async (email: string) => {
      const res = await call<{ accessToken: string }>("POST", `${ADMIN}/auth/login`, {
        body: { email, password: "correct-horse" },
      });
      return res.body.data.accessToken;
    };
    superAdminToken = await login("super@example.com");
    plainAdminToken = await login("plain@example.com");
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("refuses to start a game before any questions exist", async () => {
    const { body: reg } = await register("Early Bird", "0700000001");
    const res = await call("POST", `${PUBLIC}/sessions`, { token: reg.data.token });
    expect(res.status).toBe(503);
  });

  it("lets only a SUPER_ADMIN create questions", async () => {
    const question = { text: "Q?", options: ["A", "B"], correctOptionIndex: 0 };
    const forbidden = await call("POST", `${ADMIN}/questions`, { token: plainAdminToken, body: question });
    expect(forbidden.status).toBe(403);

    const badIndex = await call("POST", `${ADMIN}/questions`, {
      token: superAdminToken,
      body: { ...question, correctOptionIndex: 5 },
    });
    expect(badIndex.status).toBe(400);
  });

  it("bulk-creates questions and stores the correct answer by index", async () => {
    const questions = Array.from({ length: 12 }, (_, i) => ({
      text: `Question ${i + 1}?`,
      options: [`Wrong ${i}a`, `Right ${i}`, `Wrong ${i}b`, `Wrong ${i}c`],
      correctOptionIndex: 1,
    }));
    const res = await call<{ createdCount: number }>("POST", `${ADMIN}/questions/bulk`, {
      token: superAdminToken,
      body: { questions },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.createdCount).toBe(12);

    const list = await call<{ text: string; correctOptionIndex: number; options: { text: string }[] }[]>(
      "GET",
      `${ADMIN}/questions`,
      { token: plainAdminToken }
    );
    expect(list.body.data).toHaveLength(12);
    for (const q of list.body.data) {
      expect(q.options[q.correctOptionIndex]?.text).toMatch(/^Right/);
    }
  });

  it("serves the public config with defaults and lets a SUPER_ADMIN change it", async () => {
    const before = await call<{ questionsPerGame: number }>("GET", `${PUBLIC}/config`);
    expect(before.body.data.questionsPerGame).toBe(10);

    const update = await call<{ answerColors: string[] }>("PATCH", `${ADMIN}/config`, {
      token: superAdminToken,
      body: { answerColors: ["#111111", "#222222", "#333333", "#444444"] },
    });
    expect(update.status).toBe(200);
    expect(update.body.data.answerColors).toEqual(["#111111", "#222222", "#333333", "#444444"]);
  });

  it("rejects bad registration input with the messages the frontend shows", async () => {
    const noName = await register("", "0712345678");
    expect(noName.status).toBe(400);
    expect(noName.body.message).toMatch(/Please insert name/);

    const badPhone = await register("Jane", "12345");
    expect(badPhone.status).toBe(400);
    expect(badPhone.body.message).toBe("Please insert correct phone number");
  });

  it("plays a full game: start, resume, submit, server-side score", async () => {
    const reg = await register("Jane", "0712345678");
    expect(reg.status).toBe(201);
    const token = reg.body.data.token;

    const start = await call<PlayPayload>("POST", `${PUBLIC}/sessions`, { token });
    expect(start.status).toBe(200);
    const play = start.body.data;
    expect(play.questions).toHaveLength(10);
    expect(play.config.answerColors).toHaveLength(4);
    for (const q of play.questions) {
      expect(q.options.map((o) => o.id)).toContain(q.correctOptionId);
    }

    // A refresh mid-game returns the same session and the same questions.
    const resume = await call<PlayPayload>("POST", `${PUBLIC}/sessions`, { token });
    expect(resume.body.data.session.id).toBe(play.session.id);
    expect(resume.body.data.questions.map((q) => q.id)).toEqual(play.questions.map((q) => q.id));

    // 6 right, 2 wrong, 1 explicit skip, 1 not sent at all (= skipped).
    const answers = play.questions.slice(0, 9).map((q, i) => {
      if (i < 6) return { questionId: q.id, selectedOptionId: q.correctOptionId };
      if (i < 8) {
        const wrong = q.options.find((o) => o.id !== q.correctOptionId);
        return { questionId: q.id, selectedOptionId: wrong?.id ?? null };
      }
      return { questionId: q.id, selectedOptionId: null };
    });

    const submit = await call<ResultPayload>("POST", `${PUBLIC}/sessions/${play.session.id}/submit`, {
      token,
      body: { answers },
    });
    expect(submit.status).toBe(200);
    expect(submit.body.data).toMatchObject({
      totalQuestions: 10,
      correctCount: 6,
      wrongCount: 2,
      skippedCount: 2,
      scorePercent: 60,
      isLate: false,
    });

    // A retry (e.g. dropped response) returns the stored result - even if
    // it claims every answer was right.
    const allRight = play.questions.map((q) => ({ questionId: q.id, selectedOptionId: q.correctOptionId }));
    const retry = await call<ResultPayload>("POST", `${PUBLIC}/sessions/${play.session.id}/submit`, {
      token,
      body: { answers: allRight },
    });
    expect(retry.body.data.scorePercent).toBe(60);

    // The phone has now played: registering again (in any format) is refused.
    const again = await register("Jane Again", "+254 712 345 678");
    expect(again.status).toBe(409);
    expect(again.body.message).toBe("You have already played");

    const restart = await call("POST", `${PUBLIC}/sessions`, { token });
    expect(restart.status).toBe(409);
  });

  it("ignores any score field sent by the client", async () => {
    const { body: reg } = await register("Cheater", "0722000000");
    const { body: start } = await call<PlayPayload>("POST", `${PUBLIC}/sessions`, { token: reg.data.token });
    const res = await call<ResultPayload>("POST", `${PUBLIC}/sessions/${start.data.session.id}/submit`, {
      token: reg.data.token,
      body: { answers: [], score: 100, scorePercent: 100 },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.scorePercent).toBe(0);
    expect(res.body.data.skippedCount).toBe(10);
  });

  it("lets a player who registered but never finished resume with a new token", async () => {
    const first = await register("Walker", "0733000000");
    const { body: start } = await call<PlayPayload>("POST", `${PUBLIC}/sessions`, {
      token: first.body.data.token,
    });

    const second = await register("Walker", "0733000000");
    expect(second.status).toBe(200);
    const { body: resumed } = await call<PlayPayload>("POST", `${PUBLIC}/sessions`, {
      token: second.body.data.token,
    });
    expect(resumed.data.session.id).toBe(start.data.session.id);
  });

  it("does not let one player submit another player's session", async () => {
    const a = await register("Alice", "0744000000");
    const b = await register("Bob", "0755000000");
    const { body: aStart } = await call<PlayPayload>("POST", `${PUBLIC}/sessions`, { token: a.body.data.token });

    const res = await call("POST", `${PUBLIC}/sessions/${aStart.data.session.id}/submit`, {
      token: b.body.data.token,
      body: { answers: [] },
    });
    expect(res.status).toBe(404);
  });

  it("rejects admin tokens on player routes and player tokens on admin routes", async () => {
    const asAdmin = await call("POST", `${PUBLIC}/sessions`, { token: superAdminToken });
    expect(asAdmin.status).toBe(401);

    const { body: reg } = await register("Mallory", "0766000000");
    const asPlayer = await call("GET", `${ADMIN}/players`, { token: reg.data.token });
    expect(asPlayer.status).toBe(401);
  });

  it("flags a submit that arrives long after the time limit", async () => {
    const { body: reg } = await register("Slow", "0777000000");
    const { body: start } = await call<PlayPayload>("POST", `${PUBLIC}/sessions`, { token: reg.data.token });
    await Session.updateOne(
      { _id: start.data.session.id },
      { $set: { startedAt: new Date(Date.now() - 60 * 60 * 1000) } }
    );

    const res = await call<ResultPayload>("POST", `${PUBLIC}/sessions/${start.data.session.id}/submit`, {
      token: reg.data.token,
      body: { answers: [] },
    });
    expect(res.body.data.isLate).toBe(true);
  });

  it("reports players and a leaderboard to admins", async () => {
    const players = await call<{ total: number; items: { name: string; status: string }[] }>(
      "GET",
      `${ADMIN}/players?status=COMPLETED`,
      { token: plainAdminToken }
    );
    expect(players.status).toBe(200);
    expect(players.body.data.items.every((p) => p.status === "COMPLETED")).toBe(true);
    expect(players.body.data.items.map((p) => p.name)).toContain("Jane");

    const notStarted = await call<{ items: { name: string }[] }>(
      "GET",
      `${ADMIN}/players?status=NOT_STARTED`,
      { token: plainAdminToken }
    );
    expect(notStarted.body.data.items.map((p) => p.name)).toContain("Mallory");

    const board = await call<{ rank: number; name: string; scorePercent: number }[]>(
      "GET",
      `${ADMIN}/leaderboard`,
      { token: plainAdminToken }
    );
    expect(board.body.data[0]).toMatchObject({ rank: 1, name: "Jane", scorePercent: 60 });
    // The late game is left off by default.
    expect(board.body.data.map((r) => r.name)).not.toContain("Slow");
  });
});
