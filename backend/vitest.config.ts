import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 120000,
    hookTimeout: 600000,
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./src/tests/setup.ts"],
  },
});
