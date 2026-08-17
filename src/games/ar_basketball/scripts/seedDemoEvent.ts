import "../../../core/utils/cryptoPolyfill";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { Event } from "../models/Event";
import { GameConfig } from "../models/GameConfig";
import { LeaderboardConfig } from "../models/LeaderboardConfig";
import { RegistrationConfig } from "../models/RegistrationConfig";

// Demo data matching the spec's own "IGURU Demo" example exactly - useful
// for smoke-testing the full public flow (config -> register -> start ->
// complete -> leaderboard) without hand-building an event via the admin API
// first. Re-runnable: every $set below re-syncs the demo event to these
// values rather than only setting them on first insert, so the demo config
// never drifts from what's written here.
const run = async (): Promise<void> => {
  await connectDatabase();

  const organization = await Organization.findOneAndUpdate(
    { slug: "iguru-demo" },
    { $setOnInsert: { slug: "iguru-demo", name: "IGURU Demo" } },
    { upsert: true, new: true }
  );

  const event = await Event.findOneAndUpdate(
    { code: "iguru2026" },
    {
      $set: {
        name: "AR Basketball Demo",
        organizationId: organization._id,
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2027-01-01T00:00:00Z"),
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );

  await RegistrationConfig.findOneAndUpdate(
    { eventId: event._id },
    {
      $set: {
        playerMode: "registered",
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "phone", label: "Phone Number", type: "phone", required: true },
        ],
        phoneFieldKey: "phone",
        nameFieldKey: "name",
      },
    },
    { upsert: true, new: true }
  );

  await GameConfig.findOneAndUpdate(
    { eventId: event._id },
    {
      $set: {
        durationSeconds: 30,
        normalBasketPoints: 2,
        swishEnabled: true,
        swishPoints: 3,
        longRangeEnabled: true,
        longRangeDistanceMeters: 3,
        longRangePoints: 3,
        streakEnabled: true,
        streakRequired: 3,
        streakBonusPoints: 2,
        leaderboardEnabled: true,
      },
    },
    { upsert: true, new: true }
  );

  await LeaderboardConfig.findOneAndUpdate(
    { eventId: event._id },
    { $set: { rankingStrategy: "highest_score", displayLimit: 10 } },
    { upsert: true, new: true }
  );

  logger.info(
    { organization: organization.slug, eventCode: event.code },
    "Demo event seeded"
  );
};

run()
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to seed demo event");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
