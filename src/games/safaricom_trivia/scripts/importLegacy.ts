import "../../../core/utils/cryptoPolyfill";
import mongoose, { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { env } from "../../../core/config/env";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { GameConfig } from "../models/GameConfig";
import { MAX_OPTIONS, MIN_OPTIONS, Question } from "../models/Question";

// One-off import of questions and answer colours from the original
// safaricom_triviabackend01 database. Reads the legacy collections with
// the raw driver (no legacy models needed) and writes this game's models
// into MONGO_URI.
//
// The legacy data stores both `answers[]` and a `correct_answer` index,
// but the legacy frontend ignored correct_answer and treated answers[0]
// as correct. Which one is actually right depends on how the data was
// entered, so the script refuses to guess: run with --dry-run first, look
// at the report, then pass --correct-from first|index explicitly.

type CorrectFrom = "first" | "index";

interface ParsedArgs {
  sourceUri: string;
  org: string;
  correctFrom: CorrectFrom | null;
  dryRun: boolean;
}

const USAGE =
  "Usage: LEGACY_MONGODB_URI=<uri> npm run import:legacy:safaricom_trivia -- [--org <slug>] (--dry-run | --correct-from first|index)";

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };

  // From the environment rather than a flag, so the connection string
  // (with its password) doesn't land in shell history.
  const sourceUri = process.env.LEGACY_MONGODB_URI;
  const dryRun = args.includes("--dry-run");
  const correctFromArg = get("--correct-from");

  if (!sourceUri) {
    throw new Error(`LEGACY_MONGODB_URI is not set. ${USAGE}`);
  }
  if (correctFromArg !== undefined && correctFromArg !== "first" && correctFromArg !== "index") {
    throw new Error(`--correct-from must be "first" or "index". ${USAGE}`);
  }
  if (!dryRun && !correctFromArg) {
    throw new Error(`Pass --dry-run to inspect the data, or --correct-from to import. ${USAGE}`);
  }

  return {
    sourceUri,
    org: get("--org") ?? env.SAFARICOM_TRIVIA_ORG_SLUG,
    correctFrom: (correctFromArg as CorrectFrom | undefined) ?? null,
    dryRun,
  };
};

interface LegacyQuestion {
  _id: Types.ObjectId;
  text?: unknown;
  answers?: unknown;
  correct_answer?: unknown;
}

interface CleanLegacyQuestion {
  text: string;
  answers: string[];
  correctAnswerIndex: number | null;
}

// Drops anything this game can't play: missing text, non-string answers,
// too few/many options, duplicate options.
const clean = (doc: LegacyQuestion): CleanLegacyQuestion | string => {
  if (typeof doc.text !== "string" || doc.text.trim() === "") {
    return "missing text";
  }
  if (!Array.isArray(doc.answers) || !doc.answers.every((a) => typeof a === "string")) {
    return "answers is not a list of strings";
  }
  const answers = (doc.answers as string[]).map((a) => a.trim()).filter((a) => a !== "");
  if (answers.length < MIN_OPTIONS || answers.length > MAX_OPTIONS) {
    return `has ${answers.length} answers (need ${MIN_OPTIONS}-${MAX_OPTIONS})`;
  }
  if (new Set(answers.map((a) => a.toLowerCase())).size !== answers.length) {
    return "duplicate answers";
  }
  const idx = doc.correct_answer;
  const correctAnswerIndex =
    typeof idx === "number" && Number.isInteger(idx) && idx >= 0 && idx < answers.length ? idx : null;
  return { text: doc.text.trim(), answers, correctAnswerIndex };
};

const run = async (): Promise<void> => {
  const { sourceUri, org, correctFrom, dryRun } = parseArgs();

  const legacy = await mongoose.createConnection(sourceUri).asPromise();
  let legacyQuestions: LegacyQuestion[];
  let legacyColors: unknown[] | null = null;
  try {
    const legacyDb = legacy.db;
    if (!legacyDb) {
      throw new Error("Could not open the legacy database");
    }
    // Mongoose pluralized the legacy model names "sample_one_trivia" and
    // "colors_answer" into these collection names.
    legacyQuestions = await legacyDb
      .collection<LegacyQuestion>("sample_one_trivias")
      .find({})
      .toArray();
    const colorsDoc = await legacyDb
      .collection<{ colors_answers?: unknown }>("colors_answers")
      .findOne({});
    if (Array.isArray(colorsDoc?.colors_answers)) {
      legacyColors = colorsDoc.colors_answers;
    }
  } finally {
    await legacy.close();
  }

  const valid: CleanLegacyQuestion[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const doc of legacyQuestions) {
    const result = clean(doc);
    if (typeof result === "string") {
      skipped.push({ id: doc._id.toString(), reason: result });
    } else {
      valid.push(result);
    }
  }

  const colors = (legacyColors ?? []).filter(
    (c): c is string => typeof c === "string" && c.trim() !== ""
  );

  if (dryRun) {
    const withIndex = valid.filter((q) => q.correctAnswerIndex !== null);
    const indexIsZero = withIndex.filter((q) => q.correctAnswerIndex === 0);
    logger.info(
      {
        legacyQuestions: legacyQuestions.length,
        importable: valid.length,
        skipped,
        withValidCorrectAnswerIndex: withIndex.length,
        correctAnswerIndexIsZero: indexIsZero.length,
        colors,
        samples: valid.slice(0, 5).map((q) => ({
          text: q.text,
          answers: q.answers,
          correct_answer: q.correctAnswerIndex,
          "answers[0]": q.answers[0],
          "answers[correct_answer]": q.correctAnswerIndex === null ? null : q.answers[q.correctAnswerIndex],
        })),
      },
      "Dry run - nothing written. Check which of answers[0] / answers[correct_answer] is really correct in the samples, then re-run with --correct-from first|index"
    );
    return;
  }

  await connectDatabase();

  const organization = await Organization.findOneAndUpdate(
    { slug: org },
    { $setOnInsert: { slug: org, name: org } },
    { upsert: true, returnDocument: "after" }
  );

  // Re-runnable: questions whose text already exists for this org are
  // skipped, so running the import twice doesn't duplicate them.
  const existingTexts = new Set(
    (await Question.find({ organizationId: organization._id }).select("text")).map((q) =>
      q.text.toLowerCase()
    )
  );

  const toInsert = [];
  let missingIndex = 0;
  for (const q of valid) {
    if (existingTexts.has(q.text.toLowerCase())) {
      continue;
    }
    const correctIndex = correctFrom === "first" ? 0 : q.correctAnswerIndex;
    if (correctIndex === null) {
      missingIndex += 1;
      continue;
    }
    const options = q.answers.map((text) => ({ _id: new Types.ObjectId(), text }));
    const correct = options[correctIndex];
    if (!correct) {
      missingIndex += 1;
      continue;
    }
    toInsert.push({
      organizationId: organization._id,
      text: q.text,
      options,
      correctOptionId: correct._id,
      isActive: true,
    });
  }

  if (toInsert.length > 0) {
    await Question.insertMany(toInsert);
  }

  if (colors.length > 0) {
    await GameConfig.findOneAndUpdate(
      { organizationId: organization._id },
      { $set: { answerColors: colors.slice(0, 6) } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  logger.info(
    {
      organization: organization.slug,
      imported: toInsert.length,
      alreadyPresent: valid.length - toInsert.length - missingIndex,
      skippedInvalid: skipped.length,
      skippedNoCorrectIndex: missingIndex,
      colorsImported: colors.length > 0 ? colors.slice(0, 6) : null,
    },
    "Legacy import complete"
  );
};

run()
  .catch((err: unknown) => {
    logger.error({ err }, "Legacy import failed");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
