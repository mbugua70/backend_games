import "../../../core/utils/cryptoPolyfill";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { DIMENSIONS, Question } from "../models/Question";
import { Profile } from "../models/Profile";

const USAGE = "Usage: npm run seed:content:safaricom_ceo -- --org <slug>";

const parseArgs = (): { org: string } => {
  const args = process.argv.slice(2);
  const index = args.indexOf("--org");
  const org = index === -1 ? undefined : args[index + 1];
  if (!org) {
    throw new Error(USAGE);
  }
  return { org };
};

// The client's approved question/option copy and final profile-selection
// rules don't exist yet (see services/profileResolver.service.ts). This
// seeds the DB SHAPE the game needs - 5 questions each with 5 correctly
// leveled options, plus the 5 named profiles - using clearly labeled
// placeholder text, rather than inventing content that would look real.
//
// Questions are seeded isActive: false (their options are active/valid so
// an admin only has to flip isActive: true once real copy replaces the
// placeholder, per question.service.ts's activation rule) - a fresh seed
// can never make placeholder text playable by accident. Profiles are
// seeded isActive: true since they carry no participant-facing risk until
// a real ProfileResolver starts assigning them.
const PLACEHOLDER_PROFILES = [
  { code: "FOUNDATION_BUILDER", name: "Foundation Builder", displayOrder: 1 },
  { code: "CONNECTED_OPERATOR", name: "Connected Operator", displayOrder: 2 },
  { code: "INTELLIGENT_GROWTH_BUILDER", name: "Intelligent Growth Builder", displayOrder: 3 },
  { code: "RESILIENCE_LEADER", name: "Resilience Leader", displayOrder: 4 },
  { code: "FUTURE_READY_ENTERPRISE", name: "Future-Ready Enterprise", displayOrder: 5 },
] as const;

const run = async (): Promise<void> => {
  const { org } = parseArgs();
  await connectDatabase();

  const organization = await Organization.findOne({ slug: org });
  if (!organization) {
    throw new Error(
      `Organization "${org}" does not exist yet - run seed:admin:safaricom_ceo first`
    );
  }

  for (let i = 0; i < DIMENSIONS.length; i += 1) {
    const dimension = DIMENSIONS[i]!;
    await Question.findOneAndUpdate(
      { organizationId: organization._id, dimension },
      {
        $setOnInsert: {
          organizationId: organization._id,
          dimension,
          text: `[PLACEHOLDER] ${dimension} question - replace via PATCH before going live`,
          order: i + 1,
          isActive: false,
          options: [1, 2, 3, 4, 5].map((level) => ({
            text: `[PLACEHOLDER] ${dimension} option, level ${level}`,
            level,
            order: level,
            isActive: true,
          })),
        },
      },
      { upsert: true, new: true }
    );
  }

  for (const profile of PLACEHOLDER_PROFILES) {
    await Profile.findOneAndUpdate(
      { organizationId: organization._id, code: profile.code },
      {
        $setOnInsert: {
          organizationId: organization._id,
          code: profile.code,
          name: profile.name,
          description: `[PLACEHOLDER] description for ${profile.name} - replace via PATCH before going live`,
          isActive: true,
          displayOrder: profile.displayOrder,
        },
      },
      { upsert: true, new: true }
    );
  }

  logger.info({ organization: organization.slug }, "safaricom_ceo placeholder content seeded");
};

run()
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to seed safaricom_ceo content");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
