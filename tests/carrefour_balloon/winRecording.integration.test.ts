import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startReplSet } from "../testUtils/mongoReplSet";
import { Organization } from "../../src/core/models/Organization";
import { Brand } from "../../src/games/carrefour_balloon/models/Brand";
import { Event } from "../../src/games/carrefour_balloon/models/Event";
import { Gift } from "../../src/games/carrefour_balloon/models/Gift";
import { GiftPool } from "../../src/games/carrefour_balloon/models/GiftPool";
import { GiftPoolEntry } from "../../src/games/carrefour_balloon/models/GiftPoolEntry";
import { WinningRecord } from "../../src/games/carrefour_balloon/models/WinningRecord";
import { RecordWinInput, recordWin } from "../../src/games/carrefour_balloon/services/win.service";

describe("win.service#recordWin", () => {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await startReplSet();
    await mongoose.connect(replSet.getUri(), { replicaSet: "testset" });
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Organization.deleteMany({}),
      Event.deleteMany({}),
      Brand.deleteMany({}),
      Gift.deleteMany({}),
      GiftPool.deleteMany({}),
      GiftPoolEntry.deleteMany({}),
      WinningRecord.deleteMany({}),
    ]);
  });

  const buildFixture = async (availableQuantity: number) => {
    const org = await Organization.create({ name: "Org", slug: `org-${Date.now()}-${Math.random()}` });
    const event = await Event.create({
      name: "Event",
      code: `event-${Date.now()}-${Math.random()}`,
      organizationId: org._id,
      giftPoolMode: "shared",
      status: "live",
      registrationEnabled: false,
    });
    const brand = await Brand.create({ eventId: event._id, name: "Brand", logoUrl: "x", displayOrder: 1 });
    const pool = await GiftPool.create({
      eventId: event._id,
      brandId: null,
      balloonCount: 10,
      guaranteedNoGiftBalloonCount: 2,
      maxPopsPerRound: 3,
      maxWinsPerRound: 1,
    });
    const gift = await Gift.create({ eventId: event._id, name: "Tote Bag" });
    const entry = await GiftPoolEntry.create({
      giftPoolId: pool._id,
      giftId: gift._id,
      visible: true,
      awardEnabled: true,
      availableQuantity,
      probabilityPercent: 500,
      displayOrder: 1,
    });
    return { event, brand, pool, gift, entry };
  };

  const baseInput = (fixture: Awaited<ReturnType<typeof buildFixture>>, overrides: Partial<RecordWinInput> = {}): RecordWinInput => ({
    eventId: fixture.event._id.toString(),
    brandId: fixture.brand._id.toString(),
    giftPoolId: fixture.pool._id.toString(),
    giftId: fixture.gift._id.toString(),
    roundId: "round-1",
    balloonId: "balloon-1",
    configVersion: fixture.event.configVersion,
    idempotencyKey: `key-${Math.random()}`,
    participantId: null,
    anonymousIdentity: "anon-1",
    ...overrides,
  });

  it("records a win and decrements stock by exactly one", async () => {
    const fixture = await buildFixture(5);
    const result = await recordWin(baseInput(fixture));
    expect(result.claimStatus).toBe("pending");
    expect(result.gift.id).toBe(fixture.gift._id.toString());

    const entry = await GiftPoolEntry.findById(fixture.entry._id);
    expect(entry?.availableQuantity).toBe(4);
  });

  it("returns the original result on a repeated idempotency key with the same payload, without decrementing again", async () => {
    const fixture = await buildFixture(5);
    const input = baseInput(fixture);

    const first = await recordWin(input);
    const second = await recordWin(input);

    expect(second.winId).toBe(first.winId);
    expect(second.claimReference).toBe(first.claimReference);

    const entry = await GiftPoolEntry.findById(fixture.entry._id);
    expect(entry?.availableQuantity).toBe(4);
  });

  it("rejects a reused idempotency key with different request data", async () => {
    const fixture = await buildFixture(5);
    const key = `key-${Math.random()}`;
    await recordWin(baseInput(fixture, { idempotencyKey: key }));

    await expect(
      recordWin(baseInput(fixture, { idempotencyKey: key, balloonId: "a-different-balloon" }))
    ).rejects.toThrow(/different request data/);
  });

  it("rejects a second win for the same round+balloon pair", async () => {
    const fixture = await buildFixture(5);
    await recordWin(baseInput(fixture));

    await expect(
      recordWin(baseInput(fixture, { idempotencyKey: `key-${Math.random()}` }))
    ).rejects.toThrow(/already been recorded/);
  });

  it("rejects recording a win when the gift has no stock left", async () => {
    const fixture = await buildFixture(0);
    await expect(recordWin(baseInput(fixture))).rejects.toThrow(/no longer available/);
  });

  it("lets exactly one of two concurrent requests win the last unit", async () => {
    const fixture = await buildFixture(1);

    const results = await Promise.allSettled([
      recordWin(baseInput(fixture, { idempotencyKey: "key-a", roundId: "round-a", balloonId: "balloon-a" })),
      recordWin(baseInput(fixture, { idempotencyKey: "key-b", roundId: "round-b", balloonId: "balloon-b" })),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const entry = await GiftPoolEntry.findById(fixture.entry._id);
    expect(entry?.availableQuantity).toBe(0);

    const winCount = await WinningRecord.countDocuments({ giftPoolEntryId: fixture.entry._id });
    expect(winCount).toBe(1);
  });
});
