import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Organization } from "../../src/core/models/Organization";
import { Admin } from "../../src/games/carrefour_balloon/models/Admin";
import { Event } from "../../src/games/carrefour_balloon/models/Event";
import { Gift } from "../../src/games/carrefour_balloon/models/Gift";
import { GiftPool } from "../../src/games/carrefour_balloon/models/GiftPool";
import { GiftPoolEntry } from "../../src/games/carrefour_balloon/models/GiftPoolEntry";
import { StockAdjustment } from "../../src/games/carrefour_balloon/models/StockAdjustment";
import { adjustStock, listStockAdjustments } from "../../src/games/carrefour_balloon/services/giftPoolEntry.service";

describe("giftPoolEntry.service#adjustStock", () => {
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
      Gift.deleteMany({}),
      GiftPool.deleteMany({}),
      GiftPoolEntry.deleteMany({}),
      StockAdjustment.deleteMany({}),
    ]);
  });

  const buildFixture = async (availableQuantity: number) => {
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
      availableQuantity,
      probabilityPercent: 500,
      displayOrder: 1,
    });
    return { org, event, admin, pool, gift, entry };
  };

  it("increases stock and logs the audit row", async () => {
    const f = await buildFixture(5);
    const result = await adjustStock(
      f.org._id.toString(),
      f.event._id.toString(),
      f.entry._id.toString(),
      f.admin._id.toString(),
      10,
      "Replenishment delivery"
    );

    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(15);

    const logs = await listStockAdjustments(f.org._id.toString(), f.event._id.toString());
    expect(logs).toHaveLength(1);
    expect(logs[0]?.reason).toBe("Replenishment delivery");
  });

  it("decreases stock when enough is available", async () => {
    const f = await buildFixture(10);
    const result = await adjustStock(
      f.org._id.toString(),
      f.event._id.toString(),
      f.entry._id.toString(),
      f.admin._id.toString(),
      -4,
      "Damaged units removed"
    );
    expect(result.newQuantity).toBe(6);
  });

  it("rejects a decrease that would make stock negative", async () => {
    const f = await buildFixture(3);
    await expect(
      adjustStock(
        f.org._id.toString(),
        f.event._id.toString(),
        f.entry._id.toString(),
        f.admin._id.toString(),
        -5,
        "Too many"
      )
    ).rejects.toThrow(/negative/);

    const entry = await GiftPoolEntry.findById(f.entry._id);
    expect(entry?.availableQuantity).toBe(3);
  });
});
