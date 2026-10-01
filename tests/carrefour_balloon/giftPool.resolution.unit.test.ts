import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Organization } from "../../src/core/models/Organization";
import { Brand } from "../../src/games/carrefour_balloon/models/Brand";
import { Event, EventDocument } from "../../src/games/carrefour_balloon/models/Event";
import { GiftPool } from "../../src/games/carrefour_balloon/models/GiftPool";
import { resolveGiftPool } from "../../src/games/carrefour_balloon/services/giftPool.service";

// No transactions involved in resolution, so the lighter standalone
// MongoMemoryServer (not MongoMemoryReplSet) is enough here.
describe("giftPool.service#resolveGiftPool", () => {
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
      Brand.deleteMany({}),
      GiftPool.deleteMany({}),
    ]);
  });

  const makeEvent = async (giftPoolMode: "shared" | "perBrand"): Promise<EventDocument> => {
    const org = await Organization.create({ name: "Org", slug: `org-${Date.now()}-${Math.random()}` });
    return Event.create({
      name: "Event",
      code: `event-${Date.now()}-${Math.random()}`,
      organizationId: org._id,
      giftPoolMode,
      status: "live",
    });
  };

  it("resolves the shared pool regardless of which brand is passed", async () => {
    const event = await makeEvent("shared");
    const pool = await GiftPool.create({
      eventId: event._id,
      brandId: null,
      balloonCount: 10,
      guaranteedNoGiftBalloonCount: 2,
      maxPopsPerRound: 3,
      maxWinsPerRound: 1,
    });
    const brand = await Brand.create({ eventId: event._id, name: "B1", logoUrl: "x", displayOrder: 1 });

    const resolution = await resolveGiftPool(event, brand._id.toString());
    expect(resolution.available).toBe(true);
    if (resolution.available) {
      expect(resolution.pool._id.toString()).toBe(pool._id.toString());
    }
  });

  it("returns an explicit unavailable result when no shared pool has been configured", async () => {
    const event = await makeEvent("shared");
    const resolution = await resolveGiftPool(event, null);
    expect(resolution.available).toBe(false);
  });

  it("resolves each brand's own pool in perBrand mode", async () => {
    const event = await makeEvent("perBrand");
    const brandA = await Brand.create({ eventId: event._id, name: "A", logoUrl: "x", displayOrder: 1 });
    const brandB = await Brand.create({ eventId: event._id, name: "B", logoUrl: "x", displayOrder: 2 });
    const poolA = await GiftPool.create({
      eventId: event._id,
      brandId: brandA._id,
      balloonCount: 10,
      guaranteedNoGiftBalloonCount: 2,
      maxPopsPerRound: 3,
      maxWinsPerRound: 1,
    });

    const resolutionA = await resolveGiftPool(event, brandA._id.toString());
    expect(resolutionA.available).toBe(true);
    if (resolutionA.available) {
      expect(resolutionA.pool._id.toString()).toBe(poolA._id.toString());
    }

    // brandB has no pool configured yet - explicit unavailable, not a crash
    // or a silently empty config.
    const resolutionB = await resolveGiftPool(event, brandB._id.toString());
    expect(resolutionB.available).toBe(false);
  });

  it("requires a brand to be selected in perBrand mode", async () => {
    const event = await makeEvent("perBrand");
    const resolution = await resolveGiftPool(event, null);
    expect(resolution.available).toBe(false);
  });
});
