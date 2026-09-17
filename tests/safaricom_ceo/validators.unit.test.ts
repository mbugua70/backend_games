import { describe, expect, it } from "vitest";
import { registerParticipantSchema } from "../../src/games/safaricom_ceo/validators/participant.validator";
import { createQuestionSchema } from "../../src/games/safaricom_ceo/validators/question.validator";
import { submitResponseSchema } from "../../src/games/safaricom_ceo/validators/response.validator";
import { sessionIdParamSchema } from "../../src/games/safaricom_ceo/validators/session.validator";
import { loginSchema } from "../../src/games/safaricom_ceo/validators/auth.validator";

describe("participant.validator", () => {
  const validInput = {
    name: "Ada Lovelace",
    phoneNumber: "0712345678",
    businessName: "ABC Limited",
    email: "CEO@abc.com",
    businessType: "Retail",
    numberOfEmployees: "51-100",
  };

  it("accepts a well-formed registration and normalizes the email", () => {
    const result = registerParticipantSchema.parse(validInput);
    expect(result.email).toBe("ceo@abc.com");
  });

  it("accepts non-Kenyan phone formats (no forced local formatting)", () => {
    const result = registerParticipantSchema.parse({
      ...validInput,
      phoneNumber: "+1 (555) 123-4567",
    });
    expect(result.phoneNumber).toBe("+1 (555) 123-4567");
  });

  it("rejects an invalid email and a malformed phone number", () => {
    const result = registerParticipantSchema.safeParse({
      ...validInput,
      email: "not-an-email",
      phoneNumber: "call me maybe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name - the only required field", () => {
    const withoutName: Partial<typeof validInput> = { ...validInput };
    delete withoutName.name;
    const result = registerParticipantSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it("accepts registration with only a name - every other field is optional", () => {
    const result = registerParticipantSchema.safeParse({ name: "Ada Lovelace" });
    expect(result.success).toBe(true);
  });
});

describe("question.validator", () => {
  const option = (level: number) => ({ text: `Option ${level}`, level, order: level });

  it("requires exactly 5 options", () => {
    const tooFew = createQuestionSchema.safeParse({
      dimension: "VISIBILITY",
      text: "How visible are you?",
      order: 1,
      options: [option(1), option(2)],
    });
    expect(tooFew.success).toBe(false);

    const justRight = createQuestionSchema.safeParse({
      dimension: "VISIBILITY",
      text: "How visible are you?",
      order: 1,
      options: [1, 2, 3, 4, 5].map(option),
    });
    expect(justRight.success).toBe(true);
  });

  it("rejects a level outside 1-5", () => {
    const result = createQuestionSchema.safeParse({
      dimension: "VISIBILITY",
      text: "How visible are you?",
      order: 1,
      options: [option(0), option(2), option(3), option(4), option(5)],
    });
    expect(result.success).toBe(false);
  });
});

describe("response/session validators reject malformed ids", () => {
  it("rejects a non-ObjectId sessionId", () => {
    expect(sessionIdParamSchema.safeParse({ sessionId: "not-an-id" }).success).toBe(false);
    expect(sessionIdParamSchema.safeParse({ sessionId: "a".repeat(24) }).success).toBe(true);
  });

  it("rejects a non-ObjectId answerOptionId", () => {
    expect(submitResponseSchema.safeParse({ answerOptionId: "123" }).success).toBe(false);
  });
});

describe("auth.validator", () => {
  it("normalizes login email and rejects an empty password", () => {
    const ok = loginSchema.parse({ email: "Admin@Example.com", password: "x" });
    expect(ok.email).toBe("admin@example.com");

    expect(loginSchema.safeParse({ email: "admin@example.com", password: "" }).success).toBe(
      false
    );
  });
});
