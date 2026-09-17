import "../../../core/utils/cryptoPolyfill";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { DIMENSIONS, Dimension, Question } from "../models/Question";
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

// Question and Profile copy are both first-draft real content now (not
// placeholder), sourced from the approved UX mockup
// (WhatsApp Image 2026-09-16, screens 3-7) for questions/options, and from
// 60_Second_CEO_Challenge_Agency_Brief.docx section 9 ("BUILD 4-5 CEO
// PROFILES") for the 5 profile names/descriptions - see
// profileResolver.service.ts for the scoring-pattern rule that assigns one
// of these 5 to a completed session. Still needs final creative/business
// sign-off before a real event - PATCH /questions/:id or /profiles/:id once
// approved copy supersedes this.
//
// Both Questions and Profiles are seeded isActive: true and use $set (not
// $setOnInsert) for their content fields, so re-running this script always
// syncs a DB that already has the old placeholder/draft copy to the latest
// authored version here - only identity fields (organizationId, dimension,
// code) are insert-only.
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

// One question per dimension, in DIMENSIONS order, each with 5 response
// options moving from reactive/basic (level 1) to proactive/advanced
// (level 5) per the brief's response-structure rule - copy taken directly
// from the approved mockup so this matches what's already been signed off
// visually, not invented separately here.
const DRAFT_QUESTIONS: Record<Dimension, { text: string; options: string[] }> = {
  VISIBILITY: {
    text: "As your business grows, how quickly can you see what's happening across it?",
    options: [
      "Mostly after problems appear",
      "Through periodic reports",
      "Across key parts of the business",
      "Near real-time across most operations",
      "Predictively, before action is required",
    ],
  },
  EFFICIENCY: {
    text: "When the business gets more complex, how much still depends on people doing things manually?",
    options: [
      "Almost everything is manual",
      "A lot still depends on manual work",
      "Some processes are automated",
      "Most key processes are automated",
      "We use AI and automation at scale",
    ],
  },
  CONNECTEDNESS: {
    text: "How connected are your people, locations and systems when decisions need to move quickly?",
    options: [
      "Mostly disconnected",
      "Connected in some areas",
      "Well connected across key areas",
      "Highly connected across the business",
      "Seamless, real-time connectivity",
    ],
  },
  RESILIENCE: {
    text: "If something critical went down tomorrow, how confident are you that the business would keep moving?",
    options: [
      "Not very confident",
      "Somewhat confident",
      "Confident for a limited time",
      "Very confident",
      "Highly confident with strong resilience",
    ],
  },
  INTELLIGENCE: {
    text: "How much of your business can make decisions from data rather than instinct alone?",
    options: [
      "Very little - we rely on experience",
      "Some data, but not consistently",
      "Across key areas of the business",
      "Widely used, with data shaping decisions",
      "AI and advanced analytics help us predict what's next",
    ],
  },
};

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
    const draft = DRAFT_QUESTIONS[dimension];
    if (!draft) {
      throw new Error(`No draft question defined for dimension "${dimension}"`);
    }
    await Question.findOneAndUpdate(
      { organizationId: organization._id, dimension },
      {
        $setOnInsert: {
          organizationId: organization._id,
          dimension,
          order: i + 1,
        },
        $set: {
          text: draft.text,
          isActive: true,
          options: draft.options.map((text, index) => ({
            text,
            level: index + 1,
            order: index + 1,
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
          displayOrder: profile.displayOrder,
        },
        $set: {
          name: profile.name,
          description: profile.description,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
  }

  logger.info({ organization: organization.slug }, "safaricom_ceo draft content seeded");
};

run()
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to seed safaricom_ceo content");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
