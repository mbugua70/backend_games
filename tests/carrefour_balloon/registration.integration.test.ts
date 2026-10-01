import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Organization } from "../../src/core/models/Organization";
import { Event } from "../../src/games/carrefour_balloon/models/Event";
import { Participant } from "../../src/games/carrefour_balloon/models/Participant";
import { RegistrationConfig } from "../../src/games/carrefour_balloon/models/RegistrationConfig";
import { registerParticipant } from "../../src/games/carrefour_balloon/services/participant.service";

// No transactions involved in registration, so the lighter standalone
// MongoMemoryServer is enough.
describe("participant.service#registerParticipant", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Organization.deleteMany({}),
      Event.deleteMany({}),
      Participant.deleteMany({}),
      RegistrationConfig.deleteMany({}),
    ]);
  });

  const makeEvent = async (registrationEnabled: boolean) => {
    const org = await Organization.create({ name: "Org", slug: `org-${Date.now()}-${Math.random()}` });
    return Event.create({
      name: "Event",
      code: `event-${Date.now()}-${Math.random()}`,
      organizationId: org._id,
      registrationEnabled,
    });
  };

  it("rejects registration when the event has registration disabled", async () => {
    const event = await makeEvent(false);
    await expect(
      registerParticipant(event._id.toString(), { fields: {}, consentAccepted: true }, null)
    ).rejects.toThrow(/not enabled/);
  });

  it("rejects a missing required field", async () => {
    const event = await makeEvent(true);
    await RegistrationConfig.create({
      eventId: event._id,
      fields: [{ key: "name", label: "Name", type: "text", required: true }],
    });

    await expect(
      registerParticipant(event._id.toString(), { fields: {}, consentAccepted: true }, null)
    ).rejects.toThrow(/Name.*required/);
  });

  it("registers a participant and issues a token when fields are valid", async () => {
    const event = await makeEvent(true);
    await RegistrationConfig.create({
      eventId: event._id,
      fields: [{ key: "name", label: "Name", type: "text", required: true }],
    });

    const result = await registerParticipant(
      event._id.toString(),
      { fields: { name: "Jane" }, consentAccepted: true },
      null
    );

    expect(result.wasCreated).toBe(true);
    expect(result.participantToken).toEqual(expect.any(String));
  });

  it("replays the same participant for a repeated idempotency key instead of creating a duplicate", async () => {
    const event = await makeEvent(true);
    await RegistrationConfig.create({ eventId: event._id, fields: [] });

    const key = `key-${Math.random()}`;
    const first = await registerParticipant(event._id.toString(), { fields: {}, consentAccepted: true }, key);
    const second = await registerParticipant(event._id.toString(), { fields: {}, consentAccepted: true }, key);

    expect(second.participantId).toBe(first.participantId);
    expect(second.wasCreated).toBe(false);

    const count = await Participant.countDocuments({ eventId: event._id });
    expect(count).toBe(1);
  });
});
