import "../../../core/utils/cryptoPolyfill";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { Brand, BrandDocument } from "../models/Brand";
import { Event } from "../models/Event";
import { Gift, GiftDocument } from "../models/Gift";
import { GiftPool } from "../models/GiftPool";
import { GiftPoolEntry } from "../models/GiftPoolEntry";

// Demo data covering every eligibility edge case the spec calls out, so the
// seeded event is immediately useful for manually exercising
// gameConfig/probability logic: a normal gift, a visible-but-0%-probability
// gift, a visible-but-award-disabled gift, and an out-of-stock gift. Builds
// both a shared pool (the active mode) and two per-brand pools, to prove
// they coexist independently of Event.giftPoolMode - switching modes later
// never has to recreate either. Re-runnable: every write below upserts
// rather than only inserting, so re-running this script re-syncs the demo
// event to these values instead of drifting or duplicating.
const run = async (): Promise<void> => {
  await connectDatabase();

  const organization = await Organization.findOneAndUpdate(
    { slug: "carrefour-demo" },
    { $setOnInsert: { slug: "carrefour-demo", name: "Carrefour Demo" } },
    { upsert: true, new: true }
  );

  const event = await Event.findOneAndUpdate(
    { code: "carrefour-balloon-demo" },
    {
      $set: {
        name: "Carrefour Balloon Festival",
        organizationId: organization._id,
        status: "live",
        giftPoolMode: "shared",
        registrationEnabled: false,
      },
    },
    { upsert: true, new: true }
  );

  const brandDefs = [
    { name: "Carrefour", logoUrl: "https://example.com/logos/carrefour.png", displayOrder: 1 },
    { name: "Nestle", logoUrl: "https://example.com/logos/nestle.png", displayOrder: 2 },
    { name: "Coca-Cola", logoUrl: "https://example.com/logos/coca-cola.png", displayOrder: 3 },
  ];
  const brandsByName = new Map<string, BrandDocument>();
  for (const def of brandDefs) {
    const brand = await Brand.findOneAndUpdate(
      { eventId: event._id, name: def.name },
      { $set: { ...def, eventId: event._id, enabled: true } },
      { upsert: true, new: true }
    );
    brandsByName.set(def.name, brand);
  }
  const getBrand = (name: string): BrandDocument => {
    const brand = brandsByName.get(name);
    if (!brand) throw new Error(`Brand "${name}" was not seeded`);
    return brand;
  };
  const carrefourBrand = getBrand("Carrefour");
  const nestleBrand = getBrand("Nestle");
  const cocaColaBrand = getBrand("Coca-Cola");

  const giftDefs = [
    { name: "Tote Bag", description: "Reusable Carrefour tote bag", imageUrl: "https://example.com/gifts/tote-bag.png" },
    { name: "Water Bottle", description: "Branded water bottle", imageUrl: "https://example.com/gifts/water-bottle.png" },
    { name: "Gift Hamper", description: "Festive gift hamper", imageUrl: "https://example.com/gifts/gift-hamper.png" },
    { name: "Grand Prize Voucher", description: "KES 5,000 shopping voucher", imageUrl: "https://example.com/gifts/voucher.png" },
  ];
  const giftsByName = new Map<string, GiftDocument>();
  for (const def of giftDefs) {
    const gift = await Gift.findOneAndUpdate(
      { eventId: event._id, name: def.name },
      { $set: { ...def, eventId: event._id, archivedAt: null } },
      { upsert: true, new: true }
    );
    giftsByName.set(def.name, gift);
  }
  const getGift = (name: string): GiftDocument => {
    const gift = giftsByName.get(name);
    if (!gift) throw new Error(`Gift "${name}" was not seeded`);
    return gift;
  };
  const toteBag = getGift("Tote Bag");
  const waterBottle = getGift("Water Bottle");
  const giftHamper = getGift("Gift Hamper");
  const voucher = getGift("Grand Prize Voucher");

  const sharedPool = await GiftPool.findOneAndUpdate(
    { eventId: event._id, brandId: null },
    {
      $set: {
        balloonCount: 20,
        guaranteedNoGiftBalloonCount: 5,
        maxPopsPerRound: 5,
        maxWinsPerRound: 1,
        messages: {
          win: "Congratulations, you won a prize!",
          lose: "No prize this time - try again!",
          unavailable: null,
        },
      },
    },
    { upsert: true, new: true }
  );

  // One normal gift, one visible-at-0%, one visible-but-award-disabled, one
  // out-of-stock - exactly the eligibility matrix the spec's seed-data
  // requirement lists.
  const sharedPoolEntries = [
    { gift: toteBag, visible: true, awardEnabled: true, availableQuantity: 50, probabilityPercent: 500, displayOrder: 1 },
    { gift: waterBottle, visible: true, awardEnabled: true, availableQuantity: 50, probabilityPercent: 0, displayOrder: 2 },
    { gift: giftHamper, visible: true, awardEnabled: false, availableQuantity: 10, probabilityPercent: 1000, displayOrder: 3 },
    { gift: voucher, visible: true, awardEnabled: true, availableQuantity: 0, probabilityPercent: 200, displayOrder: 4 },
  ];
  for (const entry of sharedPoolEntries) {
    await GiftPoolEntry.findOneAndUpdate(
      { giftPoolId: sharedPool._id, giftId: entry.gift._id },
      {
        $set: {
          visible: entry.visible,
          awardEnabled: entry.awardEnabled,
          availableQuantity: entry.availableQuantity,
          probabilityPercent: entry.probabilityPercent,
          displayOrder: entry.displayOrder,
        },
      },
      { upsert: true, new: true }
    );
  }

  // Two per-brand pools, proving shared and perBrand configurations persist
  // side by side regardless of which mode is active (Event.giftPoolMode is
  // "shared" above).
  const perBrandDefs = [
    { brand: nestleBrand, gift: toteBag, probabilityPercent: 800 },
    { brand: cocaColaBrand, gift: waterBottle, probabilityPercent: 600 },
  ];
  for (const def of perBrandDefs) {
    const pool = await GiftPool.findOneAndUpdate(
      { eventId: event._id, brandId: def.brand._id },
      {
        $set: {
          balloonCount: 15,
          guaranteedNoGiftBalloonCount: 4,
          maxPopsPerRound: 5,
          maxWinsPerRound: 1,
          messages: { win: "You won a prize!", lose: "Try again!", unavailable: null },
        },
      },
      { upsert: true, new: true }
    );
    await GiftPoolEntry.findOneAndUpdate(
      { giftPoolId: pool._id, giftId: def.gift._id },
      {
        $set: {
          visible: true,
          awardEnabled: true,
          availableQuantity: 20,
          probabilityPercent: def.probabilityPercent,
          displayOrder: 1,
        },
      },
      { upsert: true, new: true }
    );
  }

  logger.info(
    { organization: organization.slug, eventCode: event.code, brand: carrefourBrand.name },
    "carrefour_balloon demo event seeded"
  );
};

run()
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to seed carrefour_balloon demo event");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
