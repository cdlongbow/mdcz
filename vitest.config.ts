import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": "/src/renderer/src",
      "@main": "/src/main",
      "@shared": "/packages/shared",
      "@renderer": "/src/renderer/src",
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/unit/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 120000,
          exclude: process.env.CI ? ["tests/integration/crawlers/**"] : [],
        },
      },
    ],
  },
});
