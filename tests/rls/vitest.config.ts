import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["**/*.test.ts"],
    // Force serial execution — these tests share the operational DB and
    // we don't want concurrent connect listeners fighting over SET ROLE/GUC.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
