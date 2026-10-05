import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createQuestionSchema } from "../../src/games/safaricom_trivia/validators/question.validator";

// The seed script validates content files at run time, but a broken file
// is better caught here than on event morning.
describe("safaricom_trivia content files", () => {
  const dir = path.join(__dirname, "../../src/games/safaricom_trivia/content");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("has at least one content file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s is valid and has enough questions for a game", (file) => {
    const content = z
      .object({ questions: z.array(createQuestionSchema).min(10) })
      .parse(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
    const texts = content.questions.map((q) => q.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });
});
