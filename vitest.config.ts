import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // mongodb-memory-server downloads/boots a real mongod for the
    // integration suite - slower than a typical unit test timeout.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Every integration-test file boots its own mongod (and
    // carrefour_balloon's win-recording suite boots a small replica set,
    // heavier than a standalone instance). Running test files in parallel
    // launches all of them at once, which under CPU contention can blow
    // past mongodb-memory-server's own instance-startup timeout entirely
    // (observed as "Instance failed to start within 10000ms") rather than
    // just running slower. Sequential execution trades wall-clock time for
    // that reliability.
    fileParallelism: false,
  },
});
