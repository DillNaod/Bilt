// ─── Scan Step Runner & Output Streaming ──────────────────────────────────────

import type { ScanFinding } from "../../types/index.js";
import { Spinner, isPlainMode } from "../../ui/theme.js";
import { formatFinding } from "../../ui/format.js";

/**
 * Execute a scan step with an interactive spinner and optional streaming output.
 */
export async function runScanStep(
  name: string,
  spinnerQuiet: boolean,
  action: () => Promise<ScanFinding[]>,
  detailsEnabled: boolean,
  isSilent: boolean = false,
  isQuiet: boolean = false,
): Promise<ScanFinding[]> {
  const spinner = spinnerQuiet || isSilent ? null : new Spinner(name).start();
  let stepFindings: ScanFinding[] = [];
  try {
    stepFindings = await action();
  } finally {
    if (spinner) {
      spinner.stop();
    }
  }

  if (!isSilent && stepFindings.length > 0) {
    const isPlain = isPlainMode();
    const mode = isQuiet
      ? detailsEnabled && !isPlain
        ? "headline"
        : "headline"
      : detailsEnabled || isPlain
        ? "detail"
        : "headline";

    for (const f of stepFindings) {
      console.log(formatFinding(f, mode));
      if (!isPlain && !isQuiet) {
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      console.log("");
    }
  }

  return stepFindings;
}
