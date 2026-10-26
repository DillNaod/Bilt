import { colors, glyphs } from "../ui/theme.js";
import { redactKnownSecrets } from "../core/safety/sanitizer.js";
import { logger } from "../core/logging/logger.js";
import { isBiltError, translateErrorToExitCode } from "../core/errors/index.js";

export function printError(error: unknown, debug?: boolean): void {
  const isDebug = Boolean(debug) || logger.isDebugEnabled();
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = redactKnownSecrets(rawMessage);

  // Diagnostic log for internal tracing
  const errorCode = isBiltError(error) ? error.code : error instanceof Error && (error as any).code ? String((error as any).code) : undefined;
  const context = isBiltError(error) ? error.context : undefined;

  logger.error(rawMessage, {
    errorCode,
    ...context,
    error: error instanceof Error ? error.message : String(error),
  }, error);

  // Intentional human CLI presentation
  console.error("");
  console.error(
    colors.pulseCoral.bold(`  ${glyphs.critical} Error: ${message}`),
  );
  if (isDebug && error instanceof Error && error.stack) {
    const stackLines = error.stack.split("\n").slice(1, 6);
    for (const line of stackLines) {
      console.error(colors.slateDim.dim(`  ${redactKnownSecrets(line.trim())}`));
    }
  }
  console.error("");
}

export function handleCommandError(
  error: unknown,
  options?: { debug?: boolean; defaultExitCode?: number; command?: string },
): number {
  if (options?.command) {
    logger.debug(`Command failure in ${options.command}`, {
      command: options.command,
      errorCode: isBiltError(error) ? error.code : undefined,
    });
  }
  printError(error, options?.debug);
  if (options?.defaultExitCode !== undefined) {
    return options.defaultExitCode;
  }
  return translateErrorToExitCode(error, 1);
}
