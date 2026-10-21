import { colors, glyphs } from "../../ui/theme.js";
import { reportFixPlan, reportFixComplete } from "../../ui/reporter.js";
import {
  requireTypedConfirmation,
  requireSimpleConfirmation,
} from "../../core/fix/confirm.js";
import type { Fix, FixOptions } from "../../types/index.js";
import type { FixExecutionResult } from "./types.js";

export async function runInteractiveFixes(
  actions: Fix[],
  options: FixOptions = {},
): Promise<FixExecutionResult> {
  let applied = 0;
  let skipped = 0;

  for (const action of actions) {
    const plan = await action.preview();
    await reportFixPlan(plan);

    let shouldApply = false;

    if (plan.requiresConfirmation) {
      const wantAutoFix = await requireSimpleConfirmation(
        { description: action.description } as any,
        `Would you like Bilt to run this fix automatically?`
      );
      if (wantAutoFix) {
        shouldApply = await requireTypedConfirmation(
          { description: action.description } as any,
          plan.requiresConfirmation
        );
      } else {
        shouldApply = false;
      }
    } else {
      shouldApply = await requireSimpleConfirmation({ description: action.description } as any);
    }

    if (shouldApply) {
      try {
        const result = await action.apply();

        console.log("");
        result.stepsApplied.forEach((step: string) => {
          console.log(colors.mintClear.apply(`  ${glyphs.fixed} ${step}`));
        });

        if (result.success) {
          const verification = await action.verify();
          if (verification.passed) {
            applied++;
            console.log(colors.mintClear.apply(`  ${glyphs.fixed} ${verification.message}`));
          } else {
            skipped++;
            console.log(
              colors.amberFlag.apply(`  ${glyphs.info} Fix applied but verification failed: ${verification.message}`)
            );
          }
        } else {
          skipped++;
          console.log(colors.amberFlag.apply(`  ${glyphs.info} Skipped (failed to apply: ${result.error})`));
        }
      } catch (error) {
        skipped++;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(colors.pulseCoral.apply(`  ${glyphs.critical} Error: ${msg}`));
      }
    } else {
      skipped++;
      console.log(colors.slateDim.dim(`    ${glyphs.info} Skipped`));
    }
  }

  await reportFixComplete(applied, skipped);
  return { applied, skipped };
}
