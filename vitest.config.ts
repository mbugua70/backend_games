import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // mongodb-memory-server downloads/boots a real mongod for the
    // integration suite - slower than a typical unit test timeout.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
