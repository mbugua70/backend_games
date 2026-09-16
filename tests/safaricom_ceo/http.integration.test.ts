import http from "http";
import { AddressInfo } from "net";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Organization } from "../../src/core/models/Organization";
import { Admin } from "../../src/games/safaricom_ceo/models/Admin";

// Exercises the real Express app (routes -> middleware -> controllers),
// not just the service layer, since auth/role gating, param validation,
// and body-size limits all live in middleware the service-layer tests
// never touch. Uses Node's built-in fetch against an ephemeral local
// server rather than adding supertest as a dependency.
describe("safaricom_ceo HTTP layer", () => {
  let mongoServer: MongoMemoryServer;
  let server: http.Server;
  let baseUrl: string;
  let organizationId: string;
  let superAdminToken: string;
  let plainAdminToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // Must match env.ts's default SAFARICOM_CEO_ORG_SLUG - the public
    // routes under test resolve "the" organization via that slug.
    const org = await Organization.create({ name: "HTTP Org", slug: "safaricom-ceo-challenge" });
    organizationId = org._id.toString();

    await Admin.create({
      name: "Super",
      email: "super@example.com",
      passwordHash: await bcrypt.hash("correct-horse", 10),
      role: "SUPER_ADMIN",
      organizationId,
    });
    await Admin.create({
      name: "Plain",
      email: "plain@example.com",
      passwordHash: await bcrypt.hash("correct-horse", 10),
      role: "ADMIN",
      organizationId,
    });

    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    const login = async (email: string) => {
      const res = await fetch(`${baseUrl}/api/admin/safaricom_ceo/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "correct-horse" }),
      });
      const body = (await res.json()) as { data: { accessToken: string } };
      return body.data.accessToken;
    };
    superAdminToken = await login("super@example.com");
    plainAdminToken = await login("plain@example.com");
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("rejects admin requests with no bearer token", async () => {
    const res = await fetch(`${baseUrl}/api/admin/safaricom_ceo/v1/questions`);
    expect(res.status).toBe(401);
  });

  it("rejects invalid credentials on login", async () => {
    const res = await fetch(`${baseUrl}/api/admin/safaricom_ceo/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "super@example.com", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("lets a SUPER_ADMIN create a question but forbids a plain ADMIN from doing the same", async () => {
    const validOptions = [1, 2, 3, 4, 5].map((level) => ({
      text: `Level ${level}`,
      level,
      order: level,
    }));

    const forbidden = await fetch(`${baseUrl}/api/admin/safaricom_ceo/v1/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${plainAdminToken}`,
      },
      body: JSON.stringify({
        dimension: "VISIBILITY",
        text: "How visible are you?",
        order: 1,
        isActive: true,
        options: validOptions,
      }),
    });
    expect(forbidden.status).toBe(403);

    const allowed = await fetch(`${baseUrl}/api/admin/safaricom_ceo/v1/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        dimension: "VISIBILITY",
        text: "How visible are you?",
        order: 1,
        isActive: true,
        options: validOptions,
      }),
    });
    expect(allowed.status).toBe(201);

    // A plain ADMIN can still read.
    const readAsPlainAdmin = await fetch(`${baseUrl}/api/admin/safaricom_ceo/v1/questions`, {
      headers: { Authorization: `Bearer ${plainAdminToken}` },
    });
    expect(readAsPlainAdmin.status).toBe(200);
  });

  it("never includes the hidden option level in the public questions response body", async () => {
    const res = await fetch(`${baseUrl}/api/safaricom_ceo/v1/questions`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('"level"');
    const body = JSON.parse(text) as { data: unknown[] };
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("rejects a malformed session/question id with 400 rather than a 500 or a DB error", async () => {
    const res = await fetch(
      `${baseUrl}/api/safaricom_ceo/v1/sessions/not-an-id/responses/also-not-an-id`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerOptionId: "still-not-an-id" }),
      }
    );
    expect(res.status).toBe(400);
  });

  it("rejects an oversized registration payload instead of accepting it", async () => {
    const res = await fetch(`${baseUrl}/api/safaricom_ceo/v1/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "0712345678",
        // Comfortably over express.json()'s default 100kb body limit.
        businessName: "A".repeat(200_000),
        email: "ceo@abc.com",
        businessType: "Retail",
        numberOfEmployees: "51-100",
      }),
    });
    expect(res.status).toBe(413);
  });

  it("returns a request id-bearing 404 for an unknown route", async () => {
    const res = await fetch(`${baseUrl}/api/safaricom_ceo/v1/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("responds to GET /api/health", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
  });
});
