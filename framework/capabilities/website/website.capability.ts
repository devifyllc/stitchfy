/**
 * Website capability — the one capability that's actually wired end-to-end
 * in Phase 0. It's a thin adapter over the existing, unmodified website
 * pipeline (framework/orchestrator/orchestrator.ts): plan() derives the
 * paths, execute() calls the existing runPipeline() as-is, validate() checks
 * the resulting WorkflowState. No rewrite of site-generator.ts/stitch-generator.ts.
 *
 * supports() is always true — website generation is the one capability that
 * should always be considered, matching today's default behavior.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import { runPipeline } from "../../orchestrator/orchestrator.js";
import type { WorkflowState } from "../../orchestrator/workflow-state.js";

const CAPABILITY_ID = "website";

interface WebsiteCapabilityInput {
  inputPath: string;
  outputDir: string;
}

function supports(_context: SolutionContext): boolean {
  return true;
}

async function plan(context: SolutionContext): Promise<WebsiteCapabilityInput> {
  return { inputPath: context.inputPath, outputDir: context.outputDir };
}

async function execute(
  input: WebsiteCapabilityInput,
  _context: SolutionContext
): Promise<WorkflowState> {
  return runPipeline(input.inputPath, input.outputDir);
}

async function validate(output: WorkflowState): Promise<ValidationResult<WorkflowState>> {
  if (output.stage === "complete") return validationOk(output);
  return validationFail([output.error ?? `Website pipeline ended in stage "${output.stage}"`]);
}

export const websiteCapability: StitchfyCapability<WebsiteCapabilityInput, WorkflowState> = {
  id: CAPABILITY_ID,
  name: "Website",
  version: "1.0.0",
  supports,
  plan,
  execute,
  validate,
};
