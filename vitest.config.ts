import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/cli.ts",
        "src/cli/**/*",
        "src/types/**/*",
        "src/plugins/**/*",
        "src/core/fix/confirm.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: "agent",
          include: ["tests/agent/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: "regression",
          include: ["tests/regression/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "fuzz",
          include: ["tests/fuzz/**/*.test.ts"],
          environment: "node",
          testTimeout: 60000,
        },
      },
      {
        test: {
          name: "perf",
          include: ["tests/perf/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: "foundation",
          include: ["tests/foundation/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "phase2",
          include: ["tests/phase2/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "phase3",
          include: ["tests/phase3/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "phase4",
          include: ["tests/phase4/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "phase5",
          include: ["tests/phase5/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});

