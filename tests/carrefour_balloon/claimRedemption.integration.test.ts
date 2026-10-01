import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Organization } from "../../src/core/models/Organization";
import { Admin } from "../../src/games/carrefour_balloon/models/Admin";
import { Brand } from "../../src/games/carrefour_balloon/models/Brand";
import { Event } from "../../src/games/carrefour_balloon/models/Event";
import { Gift } from "../../src/games/carrefour_balloon/models/Gift";
import { GiftPool } from "../../src/games/carrefour_balloon/models/GiftPool";
import { GiftPoolEntry } from "../../src/games/carrefour_balloon/models/GiftPoolEntry";
import { WinningRecord } from "../../src/games/carrefour_balloon/models/WinningRecord";
import { markWinClaimed } from "../../src/games/carrefour_balloon/services/adminWin.service";

describe("adminWin.service#markWinClaimed", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Organization.deleteMany({}),
      Event.deleteMany({}),
      Admin.deleteMany({}),
      Brand.deleteMany({}),
      Gift.deleteMany({}),
      GiftPool.deleteMany({}),
      GiftPoolEntry.deleteMany({}),
      WinningRecord.deleteMany({}),
    ]);
  });

  const buildFixture = async () => {
    const org = await Organization.create({ name: "Org", slug: `org-${Date.now()}-${Math.random()}` });
    const event = await Event.create({
      name: "Event",
      code: `event-${Date.now()}-${Math.random()}`,
      organizationId: org._id,
    });
    const admin = await Admin.create({
      username: `admin-${Date.now()}-${Math.random()}`,
      passwordHash: "hash",
      organizationId: org._id,
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
      availableQuantity: 5,
      probabilityPercent: 500,
      displayOrder: 1,
    });
    const win = await WinningRecord.create({
      eventId: event._id,
      brandId: brand._id,
      giftPoolId: pool._id,
      giftPoolEntryId: entry._id,
      giftId: gift._id,
      giftNameSnapshot: gift.name,
      giftImageUrlSnapshot: null,
      configVersion: 1,
      roundId: "round-1",
      balloonId: "balloon-1",
      anonymousIdentity: "anon-1",
      idempotencyKey: `key-${Math.random()}`,
      requestFingerprint: "fp",
      claimReference: `CB-${Math.random()}`,
      receivedAt: new Date(),
    });
    return { org, event, admin, win };
  };

  it("marks a pending win as claimed", async () => {
    const f = await buildFixture();
    const result = await markWinClaimed(
      f.org._id.toString(),
      f.event._id.toString(),
      f.win._id.toString(),
      f.admin._id.toString()
    );
    expect(result.claimStatus).toBe("claimed");
    expect(result.claimedByAdminId).toBe(f.admin._id.toString());
  });

  it("rejects claiming a win that was already claimed", async () => {
    const f = await buildFixture();
    await markWinClaimed(f.org._id.toString(), f.event._id.toString(), f.win._id.toString(), f.admin._id.toString());

    await expect(
      markWinClaimed(f.org._id.toString(), f.event._id.toString(), f.win._id.toString(), f.admin._id.toString())
    ).rejects.toThrow(/already been claimed/);
  });
});
