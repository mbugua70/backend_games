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
// strengths/nextFrontier are the fixed per-profile content shown on the
// result screen (see Profile.ts) - every CEO landing on a given profile
// sees the same list, regardless of their exact per-dimension scores beyond
// what already determined which profile they got. Transcribed verbatim from
// CEO Game VI.docx's "Profiles screen 8 and 10" appendix, not paraphrased.
const DRAFT_PROFILES: Array<{
  code: string;
  name: string;
  tagline: string;
  displayOrder: number;
  description: string;
  strengths: Dimension[];
  nextFrontier: { dimension: Dimension; explanation: string }[];
}> = [
  {
    code: "FOUNDATION_BUILDER",
    name: "Foundation Builder",
    tagline: "Strong foundations. Opportunity to digitise and connect.",
    displayOrder: 1,
    description:
      "Your business has strong foundations, and the fundamentals of how you see and run it are largely in place. Your next opportunity lies in digitising and connecting more of what you've already built.",
    strengths: ["VISIBILITY", "EFFICIENCY", "RESILIENCE"],
    nextFrontier: [
      {
        dimension: "VISIBILITY",
        explanation:
          "As the business grows, the gap between what's happening and what you can actually see tends to widen, and that gap is where surprises live.",
      },
      {
        dimension: "EFFICIENCY",
        explanation:
          "The more the business scales, the more manual work quietly becomes the ceiling on how fast it can grow.",
      },
      {
        dimension: "CONNECTEDNESS",
        explanation:
          "As people, locations and systems multiply, disconnected pieces slow down exactly the decisions that need to move fastest.",
      },
      {
        dimension: "RESILIENCE",
        explanation:
          "As your footprint grows, the ability to anticipate disruption and keep the business moving becomes increasingly important.",
      },
      {
        dimension: "INTELLIGENCE",
        explanation:
          "The businesses that grow fastest aren't the ones with the most data, they're the ones that turn it into decisions before instinct has to guess.",
      },
    ],
  },
  {
    code: "CONNECTED_OPERATOR",
    name: "Connected Operator",
    tagline: "Strong connectivity. Integrated operations that keep business moving.",
    displayOrder: 2,
    description:
      "Your business has strong connections across people, locations and systems. Your next opportunity lies in using that connectivity to create greater visibility, efficiency and speed.",
    strengths: ["CONNECTEDNESS", "EFFICIENCY", "VISIBILITY"],
    nextFrontier: [
      {
        dimension: "VISIBILITY",
        explanation:
          "When people, locations and systems are connected, the next opportunity is seeing what's happening across the business in real time.",
      },
      {
        dimension: "EFFICIENCY",
        explanation:
          "The more connected the operation, the greater the opportunity to automate processes and free teams to focus on higher-value decisions.",
      },
      {
        dimension: "CONNECTEDNESS",
        explanation:
          "Connectivity creates momentum — but the next step is making sure information flows seamlessly wherever decisions need to happen.",
      },
      {
        dimension: "RESILIENCE",
        explanation:
          "As the connected footprint grows, keeping critical operations secure, reliable and available becomes increasingly important.",
      },
      {
        dimension: "INTELLIGENCE",
        explanation:
          "The next step is moving from being connected to using that connected environment to anticipate what the business needs next.",
      },
    ],
  },
  {
    code: "INTELLIGENT_GROWTH_BUILDER",
    name: "Intelligent Growth Builder",
    tagline: "Strong data and AI orientation. Turning intelligence into growth.",
    displayOrder: 3,
    description:
      "Your business is using data and intelligence to shape decisions and drive growth. Your next opportunity lies in turning more of that intelligence into prediction, automation and action.",
    strengths: ["INTELLIGENCE", "VISIBILITY", "EFFICIENCY"],
    nextFrontier: [
      {
        dimension: "VISIBILITY",
        explanation:
          "More data can create more visibility, but the real opportunity is turning it into one clearer picture of what's happening across the business.",
      },
      {
        dimension: "EFFICIENCY",
        explanation:
          "As AI and automation mature, the opportunity is to move from individual use cases to smarter ways of working across the business.",
      },
      {
        dimension: "CONNECTEDNESS",
        explanation:
          "As data flows across more systems, connecting those sources can turn fragmented information into a more complete view.",
      },
      {
        dimension: "RESILIENCE",
        explanation:
          "Intelligence can help the business spot signals earlier and respond before disruption becomes a bigger problem.",
      },
      {
        dimension: "INTELLIGENCE",
        explanation:
          "The advantage isn't simply having more data, it's turning data into decisions before instinct has to guess.",
      },
    ],
  },
  {
    code: "RESILIENCE_LEADER",
    name: "Resilience Leader",
    tagline: "Strong resilience. Built to protect continuity and manage risk.",
    displayOrder: 4,
    description:
      "Your business places a strong focus on continuity, security and risk. Your next opportunity lies in using that resilience to create greater agility and confidence as the business evolves.",
    strengths: ["RESILIENCE", "VISIBILITY", "CONNECTEDNESS"],
    nextFrontier: [
      {
        dimension: "VISIBILITY",
        explanation:
          "Resilience starts with knowing what's happening. Greater visibility can help identify risks before they become disruptions.",
      },
      {
        dimension: "EFFICIENCY",
        explanation:
          "Reducing manual dependencies can remove points of failure and help critical processes keep moving when circumstances change.",
      },
      {
        dimension: "CONNECTEDNESS",
        explanation:
          "As the business becomes more connected, those connections need to remain secure, reliable and available when they matter most.",
      },
      {
        dimension: "RESILIENCE",
        explanation:
          "Resilience is not just responding when something goes wrong. It's anticipating disruption and keeping the business moving through it.",
      },
      {
        dimension: "INTELLIGENCE",
        explanation:
          "The next frontier is using data and early signals to identify risk sooner, and act before it becomes an interruption.",
      },
    ],
  },
  {
    code: "FUTURE_READY_ENTERPRISE",
    name: "Future-Ready Enterprise",
    tagline: "High maturity across the dimensions. Built to adapt and move ahead.",
    displayOrder: 5,
    description:
      "Your business is operating strongly across the dimensions that matter for the future. Your next opportunity lies in bringing these strengths together to anticipate change and turn it into advantage.",
    strengths: ["VISIBILITY", "EFFICIENCY", "CONNECTEDNESS", "RESILIENCE", "INTELLIGENCE"],
    nextFrontier: [
      {
        dimension: "VISIBILITY",
        explanation:
          "When the business can see what's happening across its operations, the next opportunity is turning visibility into faster, smarter decisions.",
      },
      {
        dimension: "EFFICIENCY",
        explanation:
          "With strong automation in place, the next frontier is using AI and intelligent systems to continuously improve how the business operates.",
      },
      {
        dimension: "CONNECTEDNESS",
        explanation:
          "The next step is moving beyond connected systems to an integrated environment where information and decisions flow seamlessly.",
      },
      {
        dimension: "RESILIENCE",
        explanation:
          "Future readiness means building resilience into the way the business operates so it can adapt without losing momentum.",
      },
      {
        dimension: "INTELLIGENCE",
        explanation:
          "The next advantage comes from turning data and intelligence into foresight, anticipating what's next before it becomes obvious.",
      },
    ],
  },
];

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
          tagline: profile.tagline,
          description: profile.description,
          strengths: profile.strengths,
          nextFrontier: profile.nextFrontier,
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
