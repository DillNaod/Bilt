import { Command } from "commander";
import { checkAndRunFirstTimeOnboarding } from "../core/onboarding/first-run.js";
import { initColorSupport, setPlainMode } from "../ui/theme.js";
import { VERSION } from "../version.js";
import { registerCheckCommands } from "./register-check.js";
import { registerDesignCommands } from "./register-design.js";
import { registerScanCommands } from "./register-scan.js";
import { registerFixCommands } from "./register-fix.js";
import { registerProjectCommands } from "./register-project.js";
import { registerAiCommands } from "./register-ai.js";
import { registerAdvancedCommands } from "./register-advanced.js";

export function createProgram(): Command {
  const program = new Command();

  program.hook("preAction", async (thisCommand, actionCommand) => {
    const opts = thisCommand.optsWithGlobals() as {
      color?: boolean;
      plain?: boolean;
      json?: boolean;
      format?: string;
    };
    if (opts.color === false) {
      initColorSupport(true);
    }
    if (opts.plain) {
      setPlainMode(true);
    }
    const isMachineFormat =
      !!opts.json ||
      opts.format === "agent" ||
      opts.format === "json" ||
      opts.format === "sarif";

    if (
      actionCommand.name() !== "welcome" &&
      actionCommand.name() !== "theme-preview"
    ) {
      await checkAndRunFirstTimeOnboarding({
        plain: opts.plain,
        json: isMachineFormat,
      });
    }
  });

  program
    .name("bilt")
    .description(
      "Zero-configuration project health toolkit. Catch secrets, fix env issues, and keep your repo clean.",
    )
    .version(VERSION, "-v, --version")
    .option("--no-color", "Disable colored output")
    .option(
      "--plain",
      "Plain output for CI — no banner, no color, greppable text",
    );

  // Register modular command groups
  registerCheckCommands(program);
  registerDesignCommands(program);
  registerScanCommands(program);
  registerFixCommands(program);
  registerProjectCommands(program);
  registerAiCommands(program);
  registerAdvancedCommands(program);

  return program;
}
