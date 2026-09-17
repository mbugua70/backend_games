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

// The client's approved question/option copy doesn't exist yet, so
// questions are still seeded as clearly labeled placeholder text (see
// below). Profiles, however, are seeded with first-draft real copy sourced
// from 60_Second_CEO_Challenge_Agency_Brief.docx section 9 ("BUILD 4-5 CEO
// PROFILES") - the brief names these exact 5 profiles and one-line
// descriptions. The fuller paragraph descriptions here expand each one-liner
// into the paragraph-length copy the result screen actually needs, in the
// brief's own voice; see profileResolver.service.ts for the scoring-pattern
// rule (also this file's own draft) that assigns one of these 5 to a
// completed session. Both need creative/business sign-off before a real
// event - PATCH /profiles/:id once approved copy exists.
//
// Questions are seeded isActive: false (their options are active/valid so
// an admin only has to flip isActive: true once real copy replaces the
// placeholder, per question.service.ts's activation rule) - a fresh seed
// can never make placeholder text playable by accident. Profiles are
// seeded isActive: true since the resolver now actively assigns them.
const DRAFT_PROFILES = [
  {
    code: "FOUNDATION_BUILDER",
    name: "Foundation Builder",
    displayOrder: 1,
    description:
      "Your business has strong foundations, and the fundamentals of how you see and run it are largely in place. Your next opportunity lies in digitising and connecting more of what you've already built.",
  },
  {
    code: "CONNECTED_OPERATOR",
    name: "Connected Operator",
    displayOrder: 2,
    description:
      "Your business shows strong connectivity and operational integration - people, locations and systems already work well together. Your next opportunity lies in extending that connectedness further, so the business can respond even faster as it grows.",
  },
  {
    code: "INTELLIGENT_GROWTH_BUILDER",
    name: "Intelligent Growth Builder",
    displayOrder: 3,
    description:
      "Your business has a strong data and AI orientation, already using information to sharpen decisions. Your next opportunity lies in extending that intelligence deeper into the business, so more decisions are backed by data rather than instinct.",
  },
  {
    code: "RESILIENCE_LEADER",
    name: "Resilience Leader",
    displayOrder: 4,
    description:
      "Your business shows a strong focus on continuity, security and risk - you're built to keep moving when things go wrong. Your next opportunity lies in turning that resilience into a genuine competitive edge as the business scales.",
  },
  {
    code: "FUTURE_READY_ENTERPRISE",
    name: "Future-Ready Enterprise",
    displayOrder: 5,
    description:
      "Your business shows high maturity across visibility, efficiency, connectedness, resilience and intelligence - a rare, well-rounded foundation. Your next opportunity lies in using that strength to move first, while others are still catching up.",
  },
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

  for (const profile of DRAFT_PROFILES) {
    await Profile.findOneAndUpdate(
      { organizationId: organization._id, code: profile.code },
      {
        $setOnInsert: {
          organizationId: organization._id,
          code: profile.code,
          name: profile.name,
          description: profile.description,
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
