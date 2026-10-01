import { MongoMemoryReplSet } from "mongodb-memory-server";

// Only carrefour_balloon's integration tests need this - every other
// game's tests use the lighter MongoMemoryServer standalone (see e.g.
// tests/safaricom_ceo/http.integration.test.ts), since they never run a
// multi-document transaction. carrefour_balloon's win-recording flow does
// (see src/games/carrefour_balloon/services/win.service.ts), and
// mongoose.startSession().withTransaction() requires a replica set even
// when it only has one member.
export const startReplSet = async (): Promise<MongoMemoryReplSet> => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await replSet.waitUntilRunning();
  return replSet;
};
