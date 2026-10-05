import "../../../core/utils/cryptoPolyfill";
import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { env } from "../../../core/config/env";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { Question } from "../models/Question";
import { createQuestionSchema } from "../validators/question.validator";

// Loads an event's question set from a JSON file in content/ (shape:
// { questions: [{ text, options[], correctOptionIndex }] }) - each entry is
// validated with the same Zod schema the admin API uses.
//
// Re-runnable: a question is matched by its text, so re-running after
// fixing a typo in an option or the correct answer updates it in place
// rather than adding a duplicate. --replace additionally deactivates every
// other question in the org, so only this file's questions get drawn -
// the normal choice when switching the game to a new event.

const DEFAULT_FILE = path.join(__dirname, "..", "content", "ziidiShariah.json");

const USAGE =
  "Usage: npm run seed:questions:safaricom_trivia -- [--org <slug>] [--file <path.json>] [--replace]";

const contentSchema = z.object({ questions: z.array(createQuestionSchema).min(1) });

const parseArgs = () => {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  if (args.includes("--help")) {
    throw new Error(USAGE);
  }
  return {
    org: get("--org") ?? env.SAFARICOM_TRIVIA_ORG_SLUG,
    file: path.resolve(get("--file") ?? DEFAULT_FILE),
    replace: args.includes("--replace"),
  };
};

const run = async (): Promise<void> => {
  const { org, file, replace } = parseArgs();
  // Validate the whole file before touching the database.
  const { questions } = contentSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));

  await connectDatabase();

  const organization = await Organization.findOneAndUpdate(
    { slug: org },
    { $setOnInsert: { slug: org, name: org } },
    { upsert: true, returnDocument: "after" }
  );

  let created = 0;
  let updated = 0;
  const keptIds: Types.ObjectId[] = [];

  for (const input of questions) {
    const options = input.options.map((text) => ({ _id: new Types.ObjectId(), text }));
    const correct = options[input.correctOptionIndex];
    if (!correct) {
      throw new Error(`correctOptionIndex out of range for "${input.text}"`);
    }
    const existing = await Question.findOne({ organizationId: organization._id, text: input.text });
    if (existing) {
      existing.set("options", options);
      existing.correctOptionId = correct._id;
      existing.isActive = input.isActive;
      await existing.save();
      keptIds.push(existing._id);
      updated += 1;
    } else {
      const doc = await Question.create({
        organizationId: organization._id,
        text: input.text,
        options,
        correctOptionId: correct._id,
        isActive: input.isActive,
      });
      keptIds.push(doc._id);
      created += 1;
    }
  }

  let deactivated = 0;
  if (replace) {
    const result = await Question.updateMany(
      { organizationId: organization._id, _id: { $nin: keptIds }, isActive: true },
      { $set: { isActive: false } }
    );
    deactivated = result.modifiedCount;
  }

  logger.info(
    { organization: organization.slug, file: path.basename(file), created, updated, deactivated },
    "Questions seeded"
  );
};

run()
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to seed questions");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
