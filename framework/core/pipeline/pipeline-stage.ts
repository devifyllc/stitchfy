/**
 * Shared stage/result tracking types for the capability pipeline — the
 * generic analog of WorkflowStage/AgentResult
 * (framework/orchestrator/workflow-state.ts) without being coupled to the
 * website blueprint.
 */

export interface PipelineResult {
  stage: string;
  success: boolean;
  summary?: string;
  error?: string;
  durationMs?: number;
}
