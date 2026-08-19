/**
 * CapabilityExecutionResult — the outcome of running one StitchfyCapability
 * through the capability runner. Populates SolutionBlueprint.capabilities.
 */

import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";

export type CapabilityExecutionStatus = "executed" | "skipped" | "failed";

export interface CapabilityExecutionResult {
  capabilityId: string;
  capabilityName: string;
  status: CapabilityExecutionStatus;
  success: boolean;
  summary?: string;
  error?: string;
  durationMs?: number;
  output?: unknown;
  /** The assessment (structured or legacy-keyword) that led to this run — see task item 21 auditability. */
  assessment?: CapabilityAssessment;
}
