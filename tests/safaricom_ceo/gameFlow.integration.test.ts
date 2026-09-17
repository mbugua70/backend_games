import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Organization } from "../../src/core/models/Organization";
import { Question } from "../../src/games/safaricom_ceo/models/Question";
import { Session } from "../../src/games/safaricom_ceo/models/Session";
import { SessionResult } from "../../src/games/safaricom_ceo/models/SessionResult";
import * as participantService from "../../src/games/safaricom_ceo/services/participant.service";
import * as questionService from "../../src/games/safaricom_ceo/services/question.service";
import * as responseService from "../../src/games/safaricom_ceo/services/response.service";
import * as sessionService from "../../src/games/safaricom_ceo/services/session.service";

// env.ts reads SAFARICOM_CEO_ORG_SLUG at module-import time (before this
// file's own top-level code runs), so tests seed an Organization matching
// its default rather than trying to override the env var here.
const ORG_SLUG = "safaricom-ceo-challenge";
const DIMENSIONS = ["VISIBILITY", "EFFICIENCY", "CONNECTEDNESS", "RESILIENCE", "INTELLIGENCE"] as const;

describe("safaricom_ceo critical game flow", () => {
  let mongoServer: MongoMemoryServer;
  let organizationId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // Mongoose builds indexes in the background after connect - waiting
    // for them here avoids a flaky race against the unique-index
    // assertions below (dimension per question, one SessionResult per
    // session) under CPU contention from other test files' in-memory
    // MongoDB instances running in parallel.
    await Promise.all([Question.init(), Session.init(), SessionResult.init()]);
    const org = await Organization.create({ name: "Test Org", slug: ORG_SLUG });
    organizationId = org._id.toString();

    for (let i = 0; i < DIMENSIONS.length; i += 1) {
      await Question.create({
        organizationId,
        dimension: DIMENSIONS[i],
        text: `${DIMENSIONS[i]} question`,
        order: i + 1,
        isActive: true,
        options: [1, 2, 3, 4, 5].map((level) => ({
          text: `Level ${level}`,
          level,
          order: level,
          isActive: true,
        })),
      });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const registerAndStart = async () => {
    const { participant } = await participantService.registerParticipant({
      name: "Ada Lovelace",
      phoneNumber: "0712345678",
      businessName: "ABC Limited",
      email: `${Math.random().toString(36).slice(2)}@abc.com`,
      businessType: "Retail",
      numberOfEmployees: "51-100",
    });
    const { session } = await sessionService.startSession(participant.id);
    return { participant, session };
  };

  it("registers a participant and normalizes the email, and a duplicate Idempotency-Key replays the same participant", async () => {
    const { participant } = await participantService.registerParticipant({
      name: "Ada Lovelace",
      phoneNumber: "0712345678",
      businessName: "ABC Limited",
      email: "CEO@abc.com",
      businessType: "Retail",
      numberOfEmployees: "51-100",
    });
    expect(participant.email).toBe("ceo@abc.com");

    const result = await participantService.registerParticipant(
      {
        name: "Ada Lovelace",
        phoneNumber: "0712345678",
        businessName: "Different Name Entirely",
        email: "different@abc.com",
        businessType: "Retail",
        numberOfEmployees: "1-10",
      },
      "same-idem-key"
    );
    const replay = await participantService.registerParticipant(
      {
        name: "Should Not Be Used",
        phoneNumber: "0700000000",
        businessName: "Should Not Be Used",
        email: "unused@abc.com",
        businessType: "Retail",
        numberOfEmployees: "1-10",
      },
      "same-idem-key"
    );
    expect(replay.wasCreated).toBe(false);
    expect(replay.participant.id).toBe(result.participant.id);
    expect(replay.participant.businessName).toBe("Different Name Entirely");
  });

  it("registers a participant with only a name - every other field is optional", async () => {
    const { participant, wasCreated } = await participantService.registerParticipant({
      name: "Walk-in Participant",
    });
    expect(wasCreated).toBe(true);
    expect(participant.name).toBe("Walk-in Participant");
    expect(participant.phoneNumber).toBeNull();
    expect(participant.email).toBeNull();

    // A name-only participant can still play the full game - session/
    // response logic never depends on any of the optional fields.
    const { session } = await sessionService.startSession(participant.id);
    expect(session.status).toBe("IN_PROGRESS");
  });

  it("rejects starting a session for a nonexistent participant", async () => {
    await expect(sessionService.startSession(new mongoose.Types.ObjectId().toString())).rejects.toThrow(
      /Participant not found/
    );
  });

  it("never exposes the hidden option level on the public questions endpoint", async () => {
    const questions = await questionService.listPublicQuestions();
    expect(questions).toHaveLength(5);
    for (const q of questions) {
      for (const option of q.options) {
        expect(option).not.toHaveProperty("level");
      }
    }
  });

  it("rejects an answer option that belongs to a different question", async () => {
    const { session } = await registerAndStart();
    const questions = await Question.find({ organizationId }).sort({ order: 1 });
    const questionA = questions[0]!;
    const questionB = questions[1]!;
    const optionFromB = questionB.options[0]!;

    await expect(
      responseService.upsertResponse(session.id, questionA._id.toString(), optionFromB._id!.toString())
    ).rejects.toThrow(/Answer option not found/);
  });

  it("rejects answering an inactive question", async () => {
    const { session } = await registerAndStart();
    const questions = await Question.find({ organizationId }).sort({ order: 1 });
    const target = questions[0]!;

    // Temporarily deactivate a shared fixture question rather than
    // creating a second one for the same dimension (organizationId +
    // dimension is unique - see Question.ts), then restore it so later
    // tests in this file see the normal 5-active-question state.
    await Question.findByIdAndUpdate(target._id, { isActive: false });
    try {
      await expect(
        responseService.upsertResponse(session.id, target._id.toString(), target.options[0]!._id!.toString())
      ).rejects.toThrow(/not currently active/);
    } finally {
      await Question.findByIdAndUpdate(target._id, { isActive: true });
    }
  });

  it("404s on a nonexistent session for resume, response submit, complete, and result", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(sessionService.getSessionForResume(fakeId)).rejects.toThrow(/Session not found/);
    await expect(sessionService.completeSession(fakeId)).rejects.toThrow(/Session not found/);
    await expect(sessionService.getResult(fakeId)).rejects.toThrow(/Session not found/);
  });

  it("rejects completing a session with unanswered questions", async () => {
    const { session } = await registerAndStart();
    const questions = await Question.find({ organizationId }).sort({ order: 1 });
    // Answer only 3 of the 5 required questions.
    for (const q of questions.slice(0, 3)) {
      await responseService.upsertResponse(session.id, q._id.toString(), q.options[0]!._id!.toString());
    }
    await expect(sessionService.completeSession(session.id)).rejects.toThrow(
      /2 of 5 required questions/
    );
  });

  it("runs the full flow: answer all 5, retry one, complete, fetch result, then reject further mutation", async () => {
    const { session } = await registerAndStart();
    const questions = await Question.find({ organizationId }).sort({ order: 1 });

    for (const q of questions) {
      await responseService.upsertResponse(session.id, q._id.toString(), q.options[2]!._id!.toString());
    }
    // Retry the same answer - PUT semantics, must not create a duplicate.
    const retried = await responseService.upsertResponse(
      session.id,
      questions[0]!._id.toString(),
      questions[0]!.options[2]!._id!.toString()
    );
    expect(retried.answeredQuestionIds).toHaveLength(5);

    // Update to a different option for one question before completing.
    await responseService.upsertResponse(
      session.id,
      questions[0]!._id.toString(),
      questions[0]!.options[4]!._id!.toString()
    );

    const result = await sessionService.completeSession(session.id);
    // level-3 answers on 4 questions + level-5 on the updated one = 17.
    expect(result.sessionId).toBe(session.id);
    expect(result.profile).toBeNull();

    const fetched = await sessionService.getResult(session.id);
    expect(fetched).toEqual(result);

    const replayedCompletion = await sessionService.completeSession(session.id);
    expect(replayedCompletion).toEqual(result);

    await expect(
      responseService.upsertResponse(
        session.id,
        questions[0]!._id.toString(),
        questions[0]!.options[0]!._id!.toString()
      )
    ).rejects.toThrow(/not in progress/);
  });

  it("never creates two SessionResult rows under concurrent completion requests", async () => {
    const { session } = await registerAndStart();
    const questions = await Question.find({ organizationId }).sort({ order: 1 });
    for (const q of questions) {
      await responseService.upsertResponse(session.id, q._id.toString(), q.options[1]!._id!.toString());
    }

    const [a, b, c] = await Promise.all([
      sessionService.completeSession(session.id),
      sessionService.completeSession(session.id),
      sessionService.completeSession(session.id),
    ]);
    expect(a).toEqual(b);
    expect(b).toEqual(c);

    const count = await SessionResult.countDocuments({ sessionId: session.id });
    expect(count).toBe(1);
  });
});
