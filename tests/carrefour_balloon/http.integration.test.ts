import http from "http";
import { AddressInfo } from "net";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startReplSet } from "../testUtils/mongoReplSet";
import { createApp } from "../../src/app";
import { Organization } from "../../src/core/models/Organization";
import { Admin } from "../../src/games/carrefour_balloon/models/Admin";

// Exercises the real Express app (routes -> middleware -> controllers),
// including the admin percent<->basis-point conversion and the win-
// recording transaction, so uses the replica-set-backed Mongo rather than
// the standalone MongoMemoryServer other games' http tests use.
describe("carrefour_balloon HTTP layer", () => {
  let replSet: MongoMemoryReplSet;
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;

  beforeAll(async () => {
    replSet = await startReplSet();
    await mongoose.connect(replSet.getUri());

    const org = await Organization.create({ name: "HTTP Org", slug: `http-org-${Date.now()}` });
    await Admin.create({
      username: "admin1",
      passwordHash: await bcrypt.hash("correct-horse", 10),
      organizationId: org._id,
    });

    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    const loginRes = await fetch(`${baseUrl}/api/admin/carrefour_balloon/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin1", password: "correct-horse" }),
    });
    const loginBody = (await loginRes.json()) as { data: { accessToken: string } };
    adminToken = loginBody.data.accessToken;
  }, 60_000);

  afterAll(async () => {
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
  });

  const authed = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  it("runs the full admin setup -> public game-config -> win-recording flow", async () => {
    const createEvent = await fetch(`${baseUrl}/api/admin/carrefour_balloon/v1/events`, {
      method: "POST",
      headers: authed(adminToken),
      body: JSON.stringify({ name: "Test Event", code: `test-event-${Date.now()}` }),
    });
    expect(createEvent.status).toBe(201);
    const { data: event } = (await createEvent.json()) as { data: { id: string } };

    await fetch(`${baseUrl}/api/admin/carrefour_balloon/v1/events/${event.id}`, {
      method: "PATCH",
      headers: authed(adminToken),
      body: JSON.stringify({ status: "live" }),
    });

    const createBrand = await fetch(`${baseUrl}/api/admin/carrefour_balloon/v1/events/${event.id}/brands`, {
      method: "POST",
      headers: authed(adminToken),
      body: JSON.stringify({ name: "Brand A", logoUrl: "https://example.com/a.png", displayOrder: 1 }),
    });
    const { data: brand } = (await createBrand.json()) as { data: { id: string } };

    const createPool = await fetch(`${baseUrl}/api/admin/carrefour_balloon/v1/events/${event.id}/gift-pools`, {
      method: "POST",
      headers: authed(adminToken),
      body: JSON.stringify({
        brandId: null,
        balloonCount: 10,
        guaranteedNoGiftBalloonCount: 2,
        maxPopsPerRound: 3,
        maxWinsPerRound: 1,
      }),
    });
    const { data: pool } = (await createPool.json()) as { data: { id: string } };

    const createGift = await fetch(`${baseUrl}/api/admin/carrefour_balloon/v1/events/${event.id}/gifts`, {
      method: "POST",
      headers: authed(adminToken),
      body: JSON.stringify({ name: "Tote Bag" }),
    });
    const { data: gift } = (await createGift.json()) as { data: { id: string } };

    const createEntry = await fetch(
      `${baseUrl}/api/admin/carrefour_balloon/v1/events/${event.id}/gift-pools/${pool.id}/entries`,
      {
        method: "POST",
        headers: authed(adminToken),
        body: JSON.stringify({ giftId: gift.id, probabilityPercent: 5, displayOrder: 1, availableQuantity: 3 }),
      }
    );
    expect(createEntry.status).toBe(201);
    const { data: entry } = (await createEntry.json()) as {
      data: { id: string; probabilityPercent: number; availableQuantity: number };
    };
    // Admin API speaks whole percent, not raw basis points.
    expect(entry.probabilityPercent).toBe(5);
    expect(entry.availableQuantity).toBe(3);

    const configRes = await fetch(
      `${baseUrl}/api/carrefour_balloon/v1/events/${event.id}/game-config?brandId=${brand.id}`
    );
    expect(configRes.status).toBe(200);
    const { data: config } = (await configRes.json()) as {
      data: { gifts: Array<{ id: string; effectiveProbabilityPercent: number }>; giftPoolId: string };
    };
    expect(config.giftPoolId).toBe(pool.id);
    expect(config.gifts).toHaveLength(1);
    expect(config.gifts[0]?.effectiveProbabilityPercent).toBe(500);

    const winRes = await fetch(`${baseUrl}/api/carrefour_balloon/v1/events/${event.id}/wins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: `key-${Date.now()}`,
        brandId: brand.id,
        giftPoolId: pool.id,
        giftId: gift.id,
        roundId: "round-1",
        balloonId: "balloon-1",
        configVersion: 1,
        anonymousIdentity: "anon-1",
      }),
    });
    expect(winRes.status).toBe(201);
    const { data: win } = (await winRes.json()) as { data: { claimReference: string; claimStatus: string } };
    expect(win.claimStatus).toBe("pending");

    const claimRes = await fetch(
      `${baseUrl}/api/admin/carrefour_balloon/v1/events/${event.id}/wins`,
      { headers: authed(adminToken) }
    );
    const { data: winsList } = (await claimRes.json()) as { data: { items: Array<{ id: string }> } };
    expect(winsList.items).toHaveLength(1);
  });

  it("rejects admin routes without a bearer token", async () => {
    const res = await fetch(`${baseUrl}/api/admin/carrefour_balloon/v1/events`);
    expect(res.status).toBe(401);
  });
});
