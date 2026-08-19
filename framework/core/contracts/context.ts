/**
 * SolutionContext — the capability-era analog of WorkflowState
 * (see framework/orchestrator/workflow-state.ts).
 *
 * WorkflowState stays untouched and keeps driving the existing
 * project.md → website-blueprint.v1.json pipeline. SolutionContext is the
 * shared object passed through business discovery, planning, and the
 * capability registry for the broader solution-engineering pipeline.
 */

import type { ParsedProject } from "../markdown-parser.js";
import type { BusinessContext } from "../../discovery/business/business-context.types.js";
import type { DiscoveryResult } from "../../discovery/discovery-result.types.js";
import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";
import type { CapabilityExecutionResult } from "../../schemas/capability/capability-result.types.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import type { SolutionPlan } from "../../planning/capability-assessment/solution-plan.types.js";

export type SolutionStage =
  | "idle"
  | "reading"
  | "discovery"
  | "planning"
  | "capabilities"
  | "validation"
  | "writing"
  | "complete"
  | "error";

export interface SolutionContext {
  projectId: string;
  inputPath: string;
  outputDir: string;
  markdown: string;
  parsed: ParsedProject;
  businessContext?: BusinessContext;
  /**
   * The full Phase 1 discovery output (goals/processes/systems/gaps/
   * traceability, etc.) — available so a future capability's supports()
   * can read structured signals instead of only businessContext's flat
   * string arrays. Not read by any capability yet; see
   * docs/architecture/ARCHITECTURE.md "Capability Selection Evolution".
   */
  discoveryResult?: DiscoveryResult;
  /** Populated once, during the "planning" stage, before any capability executes. */
  capabilityAssessments?: CapabilityAssessment[];
  solutionPlan?: SolutionPlan;
  solutionBlueprint: Partial<SolutionBlueprint>;
  capabilityResults: CapabilityExecutionResult[];
  stage: SolutionStage;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export function createSolutionContext(
  inputPath: string,
  outputDir: string,
  markdown: string,
  parsed: ParsedProject
): SolutionContext {
  return {
    projectId: `solution-${Date.now()}`,
    inputPath,
    outputDir,
    markdown,
    parsed,
    solutionBlueprint: {},
    capabilityResults: [],
    stage: "idle",
    startedAt: new Date().toISOString(),
  };
}
