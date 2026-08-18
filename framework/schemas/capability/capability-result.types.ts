/**
 * CapabilityExecutionResult — the outcome of running one StitchfyCapability
 * through the capability runner. Populates SolutionBlueprint.capabilities.
 */

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
}
