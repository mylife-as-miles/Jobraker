import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["backend/automation-worker/src/**/*.{test,spec}.ts"],
  },
});
