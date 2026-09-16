import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Organization } from "../../src/core/models/Organization";
import { Admin } from "../../src/games/safaricom_ceo/models/Admin";
import { Profile } from "../../src/games/safaricom_ceo/models/Profile";
import { Question } from "../../src/games/safaricom_ceo/models/Question";
import { Session } from "../../src/games/safaricom_ceo/models/Session";
import * as analyticsService from "../../src/games/safaricom_ceo/services/analytics.service";
import * as authService from "../../src/games/safaricom_ceo/services/auth.service";
import * as participantService from "../../src/games/safaricom_ceo/services/participant.service";
import * as profileService from "../../src/games/safaricom_ceo/services/profile.service";
import * as questionService from "../../src/games/safaricom_ceo/services/question.service";
import * as responseService from "../../src/games/safaricom_ceo/services/response.service";
import * as sessionService from "../../src/games/safaricom_ceo/services/session.service";

describe("safaricom_ceo admin auth", () => {
  let mongoServer: MongoMemoryServer;
  let organizationId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // Mongoose builds indexes in the background after connect - waiting
    // for them here avoids a flaky race against the unique-email
    // constraint under CPU contention from other test files' MongoMemoryServer
    // instances running in parallel.
    await Admin.init();
    const org = await Organization.create({ name: "Admin Org", slug: "admin-auth-org" });
    organizationId = org._id.toString();
    await Admin.create({
      name: "Root Admin",
      email: "root@example.com",
      passwordHash: await bcrypt.hash("correct-horse", 10),
      role: "SUPER_ADMIN",
      organizationId,
    });
    await Admin.create({
      name: "Disabled Admin",
      email: "disabled@example.com",
      passwordHash: await bcrypt.hash("correct-horse", 10),
      role: "ADMIN",
      organizationId,
      isActive: false,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    const result = await authService.login({ email: "root@example.com", password: "correct-horse" });
    expect(result.admin.role).toBe("SUPER_ADMIN");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();

    await expect(
      authService.login({ email: "root@example.com", password: "wrong-password" })
    ).rejects.toThrow(/Invalid email or password/);
  });

  it("rejects login for a deactivated admin", async () => {
    await expect(
      authService.login({ email: "disabled@example.com", password: "correct-horse" })
    ).rejects.toThrow(/Invalid email or password/);
  });

  it("refreshes an access token from a valid refresh token, and rejects using an access token as a refresh token", async () => {
    const { accessToken, refreshToken } = await authService.login({
      email: "root@example.com",
      password: "correct-horse",
    });
    const refreshed = await authService.refresh(refreshToken);
    expect(refreshed.accessToken).toBeTruthy();

    await expect(authService.refresh(accessToken)).rejects.toThrow(/Invalid or expired refresh token/);
    await expect(authService.refresh("not-a-real-token")).rejects.toThrow(
      /Invalid or expired refresh token/
    );
  });
});

describe("safaricom_ceo admin question/profile management", () => {
  let mongoServer: MongoMemoryServer;
  let organizationId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // See the "admin auth" describe block above for why this matters:
    // these tests specifically assert on the (organizationId, dimension)
    // and (organizationId, code) unique-index rejections.
    await Promise.all([Question.init(), Profile.init()]);
    const org = await Organization.create({ name: "Content Org", slug: "content-org" });
    organizationId = org._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const validOptions = (levels: number[]) =>
    levels.map((level, i) => ({ text: `Option ${level}`, level, order: i + 1, isActive: true }));

  it("rejects activating a question without exactly 5 active options covering levels 1-5", async () => {
    await expect(
      questionService.createQuestion(organizationId, {
        dimension: "VISIBILITY",
        text: "Q",
        order: 1,
        isActive: true,
        options: validOptions([1, 2, 3, 4, 4]),
      })
    ).rejects.toThrow(/levels 1, 2, 3, 4, and 5/);

    await expect(
      questionService.createQuestion(organizationId, {
        dimension: "VISIBILITY",
        text: "Q",
        order: 1,
        isActive: true,
        options: [
          { text: "a", level: 1, order: 1, isActive: true },
          { text: "b", level: 2, order: 1, isActive: true },
          { text: "c", level: 3, order: 3, isActive: true },
          { text: "d", level: 4, order: 4, isActive: true },
          { text: "e", level: 5, order: 5, isActive: true },
        ],
      })
    ).rejects.toThrow(/order must be unique/);
  });

  it("creates, lists, updates, and soft-deletes a question", async () => {
    const created = await questionService.createQuestion(organizationId, {
      dimension: "VISIBILITY",
      text: "How visible are you?",
      order: 1,
      isActive: true,
      options: validOptions([1, 2, 3, 4, 5]),
    });
    expect(created.isActive).toBe(true);

    const list = await questionService.listAdminQuestions(organizationId);
    expect(list.map((q) => q.id)).toContain(created.id);

    const updated = await questionService.updateQuestion(organizationId, created.id, {
      text: "Updated text",
    });
    expect(updated.text).toBe("Updated text");
    expect(updated.isActive).toBe(true);

    const deactivated = await questionService.deactivateQuestion(organizationId, created.id);
    expect(deactivated.isActive).toBe(false);
  });

  it("rejects a second question for the same dimension", async () => {
    await expect(
      questionService.createQuestion(organizationId, {
        dimension: "VISIBILITY",
        text: "Duplicate",
        order: 2,
        isActive: false,
        options: validOptions([1, 2, 3, 4, 5]),
      })
    ).rejects.toThrow(/already exists/);
  });

  it("creates a profile, uppercases its code, rejects a duplicate, and keeps code immutable on update", async () => {
    const profile = await profileService.createProfile(organizationId, {
      code: "foundation_builder",
      name: "Foundation Builder",
      description: "desc",
      isActive: true,
      displayOrder: 1,
    });
    expect(profile.code).toBe("FOUNDATION_BUILDER");

    await expect(
      profileService.createProfile(organizationId, {
        code: "FOUNDATION_BUILDER",
        name: "Dup",
        description: "dup",
        isActive: true,
        displayOrder: 2,
      })
    ).rejects.toThrow(/already exists/);

    const updated = await profileService.updateProfile(organizationId, profile.id, {
      isActive: false,
      description: "new desc",
    });
    expect(updated.code).toBe("FOUNDATION_BUILDER");
    expect(updated.isActive).toBe(false);
  });
});

describe("safaricom_ceo admin sessions + analytics", () => {
  let mongoServer: MongoMemoryServer;
  let organizationId: string;
  const dims = ["VISIBILITY", "EFFICIENCY", "CONNECTEDNESS", "RESILIENCE", "INTELLIGENCE"] as const;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // Must match env.ts's default SAFARICOM_CEO_ORG_SLUG: this block (unlike
    // the other two in this file) also drives the PUBLIC participant/
    // session/response services, which always resolve "the" organization
    // via that env slug rather than by id - see organization.service.ts.
    await Question.init();
    const org = await Organization.create({ name: "Analytics Org", slug: "safaricom-ceo-challenge" });
    organizationId = org._id.toString();

    for (let i = 0; i < dims.length; i += 1) {
      await Question.create({
        organizationId,
        dimension: dims[i],
        text: `${dims[i]} question`,
        order: i + 1,
        isActive: true,
        options: [1, 2, 3, 4, 5].map((level) => ({ text: `L${level}`, level, order: level, isActive: true })),
      });
    }

    const complete = async (businessType: string, numberOfEmployees: string) => {
      const { participant } = await participantService.registerParticipant({
        phoneNumber: "0712345678",
        businessName: "Biz",
        email: `${Math.random().toString(36).slice(2)}@example.com`,
        businessType,
        numberOfEmployees,
      });
      const { session } = await sessionService.startSession(participant.id);
      const questions = await Question.find({ organizationId });
      for (const q of questions) {
        await responseService.upsertResponse(session.id, q._id.toString(), q.options[2]!._id!.toString());
      }
      return sessionService.completeSession(session.id);
    };

    await complete("Retail", "1-10");
    await complete("Retail", "51-100");

    const { participant: abandonedParticipant } = await participantService.registerParticipant({
      phoneNumber: "0712345679",
      businessName: "Biz2",
      email: "abandoned@example.com",
      businessType: "Manufacturing",
      numberOfEmployees: "1-10",
    });
    const { session: abandonedSession } = await sessionService.startSession(abandonedParticipant.id);
    await Session.findByIdAndUpdate(abandonedSession.id, { status: "ABANDONED" });

    const { participant: inProgressParticipant } = await participantService.registerParticipant({
      phoneNumber: "0712345680",
      businessName: "Biz3",
      email: "inprogress@example.com",
      businessType: "Retail",
      numberOfEmployees: "1-10",
    });
    await sessionService.startSession(inProgressParticipant.id);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("paginates the admin session list and filters by status", async () => {
    const page1 = await sessionService.listAdminSessions(organizationId, { page: 1, limit: 2 });
    expect(page1.total).toBe(4);
    expect(page1.items).toHaveLength(2);
    expect(page1.totalPages).toBe(2);

    const page2 = await sessionService.listAdminSessions(organizationId, { page: 2, limit: 2 });
    expect(page2.items).toHaveLength(2);

    const completedOnly = await sessionService.listAdminSessions(organizationId, {
      page: 1,
      limit: 20,
      status: "COMPLETED",
    });
    expect(completedOnly.total).toBe(2);
    expect(completedOnly.items[0]!.participant?.phoneNumber).toBeTruthy();
  });

  it("returns session detail with responses and result", async () => {
    const completedOnly = await sessionService.listAdminSessions(organizationId, {
      page: 1,
      limit: 1,
      status: "COMPLETED",
    });
    const detail = await sessionService.getAdminSessionById(organizationId, completedOnly.items[0]!.id);
    expect(detail.responses).toHaveLength(5);
    expect(detail.result?.totalScore).toBe(15);
  });

  it("aggregates analytics without ever including phone or email fields", async () => {
    const summary = await analyticsService.getAnalyticsSummary(organizationId, {});
    expect(summary.totalParticipants).toBe(4);
    expect(summary.totalSessions).toBe(4);
    expect(summary.completedSessions).toBe(2);
    expect(summary.abandonedSessions).toBe(1);
    expect(summary.incompleteSessions).toBe(1);
    expect(summary.completionRate).toBe(0.5);
    expect(summary.averageScoreByDimension.VISIBILITY).toBe(3);

    const serialized = JSON.stringify(summary).toLowerCase();
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("@example.com");
  });

  it("filters analytics by businessType and 404s on an unknown profile filter", async () => {
    const retailOnly = await analyticsService.getAnalyticsSummary(organizationId, {
      businessType: "Retail",
    });
    expect(retailOnly.totalParticipants).toBe(3);
    expect(retailOnly.totalSessions).toBe(3);

    await expect(
      analyticsService.getAnalyticsSummary(organizationId, { profile: "NOPE" })
    ).rejects.toThrow(/not found/);
  });
});
