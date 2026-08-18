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
import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";
import type { CapabilityExecutionResult } from "../../schemas/capability/capability-result.types.js";

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
