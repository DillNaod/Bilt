// ─── First-Run Developer Onboarding ───────────────────────────────────────────
// Interactive welcome & feature summary presented on a developer's first run.

import Enquirer from "enquirer";
import { isFirstRun, markFirstRunCompleted } from "../ai/config.js";
import { banner, sectionHeader, divider, text, colors } from "../../ui/theme.js";
import { logger } from "../logging/logger.js";

const enquirer = new Enquirer();

export type OnboardingActionDispatcher = (action: "scan" | "ai") => Promise<void>;

export interface OnboardingOptions {
  bypassInteractive?: boolean;
  plain?: boolean;
  json?: boolean;
  actionDispatcher?: OnboardingActionDispatcher;
}

/**
 * Perform first-run onboarding if Bilt is running for the first time on this machine
 */
export async function checkAndRunFirstTimeOnboarding(options: OnboardingOptions = {}): Promise<boolean> {
  if (!isFirstRun()) return false;

  // Automatically bypass in CI, plain mode, or non-interactive runs
  if (
    options.bypassInteractive ||
    options.plain ||
    options.json ||
    process.env.CI ||
    !process.stdout.isTTY
  ) {
    logger.debug("Bypassing first-time onboarding", {
      reason: options.bypassInteractive
        ? "bypassInteractive"
        : options.plain
        ? "plain"
        : options.json
        ? "json"
        : !process.stdout.isTTY
        ? "non-tty"
        : "ci",
    });
    markFirstRunCompleted();
    return false;
  }

  logger.info("Triggering first-time interactive onboarding");
  await runOnboardingWizard(options.actionDispatcher);
  markFirstRunCompleted();
  return true;
}

/**
 * Display interactive welcome banner and quick-start menu
 */
export async function runOnboardingWizard(actionDispatcher?: OnboardingActionDispatcher): Promise<void> {
  console.log("");
  console.log(banner());
  console.log(sectionHeader("Welcome to Bilt — Zero-Configuration Project Health Toolkit!"));
  console.log(divider());

  console.log(colors.vitalTeal.apply("  What Bilt does for your codebase (100% Local Guarantee):"));
  console.log(text.bold("  ●  Zero-Config Security") + text.dim("  : Detects 30+ secret types (AWS, Stripe, JWT) before push"));
  console.log(text.bold("  ●  Instant Auto-Fixes") + text.dim("   : Safe automated fixes with 1-click snapshot restore (bilt undo)"));
  console.log(text.bold("  ●  Project Doctor") + text.dim("       : Comprehensive health scoring, repo hygiene & report cards"));
  console.log(text.bold("  ●  Optional AI Layer") + text.dim("    : Layer Claude, GPT-4o, Gemini, or Llama for bilt ask & insights"));
  console.log("");
  console.log(colors.slateDim.dim("  Tip: You can re-open this guide anytime by typing: bilt welcome"));
  console.log(divider());

  try {
    const { action } = (await enquirer.prompt({
      type: "select",
      name: "action",
      message: "Quick Start Options:",
      choices: [
        { name: "scan", message: "1. Run initial project health scan (bilt scan)" },
        { name: "ai", message: "2. Configure optional AI provider key (bilt ai setup)" },
        { name: "skip", message: "3. Continue to CLI" },
      ],
    })) as { action: string };

    if (action === "scan") {
      console.log("");
      if (actionDispatcher) {
        await actionDispatcher("scan");
      } else {
        const { executeScan } = await import("../../commands/scan.js");
        await executeScan(".", {});
      }
    } else if (action === "ai") {
      console.log("");
      if (actionDispatcher) {
        await actionDispatcher("ai");
      } else {
        const { executeAISetup } = await import("../../commands/ai.js");
        await executeAISetup();
      }
    }
  } catch (err) {
    logger.debug("Onboarding prompt interrupted or dismissed", { error: err });
  }
}
