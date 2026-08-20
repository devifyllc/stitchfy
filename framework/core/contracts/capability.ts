/**
 * StitchfyCapability — the core extension point for the solution-engineering
 * pipeline. Each capability (website, workflow-automation, ai-agents, ...)
 * implements this contract and is discovered through the CapabilityRegistry
 * (see framework/core/registry/capability-registry.ts) rather than being
 * wired into the orchestrator by name — new capabilities plug in without
 * modifying orchestration code.
 */

import type { SolutionContext } from "./context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";

export interface StitchfyCapability<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  version: string;

  /** Whether this capability is relevant given the current SolutionContext. */
  supports(context: SolutionContext): boolean;

  /**
   * Optional structured, explainable assessment (see
   * framework/planning/capability-assessment/). A capability that
   * implements this should have supports() delegate to it — one source of
   * truth for selection rules. Capabilities without assess() fall back to
   * legacyKeywordAssessment() wrapping their supports() boolean; see
   * framework/planning/capability-assessment/assess-capabilities.ts.
   */
  assess?(context: SolutionContext): CapabilityAssessment;

  /** Derive the input this capability needs to execute. */
  plan(context: SolutionContext): Promise<TInput>;

  /** Produce the capability's output (a typed SolutionBlueprint section). */
  execute(input: TInput, context: SolutionContext): Promise<TOutput>;

  /** Validate the produced output before it is merged into the blueprint. */
  validate(output: TOutput, context: SolutionContext): Promise<ValidationResult<TOutput>>;
}
