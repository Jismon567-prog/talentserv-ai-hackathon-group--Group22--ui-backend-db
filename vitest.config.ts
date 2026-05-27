import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Avoid loading .env.local during unit tests (secrets not needed for lib tests).
  envDir: "./tests",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
