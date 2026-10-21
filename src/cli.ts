#!/usr/bin/env node
// ─── Bilt CLI Entry Point ────────────────────────────────────────────────────
// Zero-configuration project health toolkit.
// Orchestration entry point; command registration is delegated to src/cli/* modules.
// ─────────────────────────────────────────────────────────────────────────────

import { initColorSupport } from "./ui/theme.js";
import { createProgram } from "./cli/index.js";

// ─── Process Signal Handlers ─────────────────────────────────────────────────

process.on("SIGINT", () => {
  process.stderr.write("\n");
  process.exit(130);
});

process.on("SIGTERM", () => {
  process.stderr.write("\n");
  process.exit(143);
});

// ─── Color Support ───────────────────────────────────────────────────────────

initColorSupport();

// ─── Program Setup & Execution ───────────────────────────────────────────────

const program = createProgram();
program.parse();
