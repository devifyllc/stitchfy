/**
 * WorkflowState — the shared context object passed to every agent.
 *
 * The blueprint accumulates through the pipeline:
 * each agent merges its owned section into state.blueprint.
 */

import type { ParsedProject } from "../core/markdown-parser.js";
import type { WebsiteBlueprint } from "../schemas/blueprint.types.js";

export type WorkflowStage =
  | "idle"
  | "reading"
  | "intake"
  | "ux"
  | "seo"
  | "accessibility"
  | "frontend"
  | "validation"
  | "writing"
  | "complete"
  | "error";

export interface AgentResult {
  stage: WorkflowStage;
  success: boolean;
  summary?: string;
  error?: string;
  durationMs?: number;
}

export interface WorkflowState {
  projectId: string;
  inputPath: string;
  outputDir: string;
  markdown: string;
  parsed: ParsedProject;
  blueprint: Partial<WebsiteBlueprint>;
  stage: WorkflowStage;
  results: AgentResult[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export function createWorkflowState(
  inputPath: string,
  outputDir: string,
  markdown: string,
  parsed: ParsedProject
): WorkflowState {
  return {
    projectId: `run-${Date.now()}`,
    inputPath,
    outputDir,
    markdown,
    parsed,
    blueprint: {},
    stage: "idle",
    results: [],
    startedAt: new Date().toISOString(),
  };
}
