/**
 * AgentRunner — executes a single agent stage.
 *
 * Agents return a Partial<WebsiteBlueprint> containing only the sections
 * they own. The orchestrator merges this into state.blueprint.
 */

import type { WorkflowState, AgentResult, WorkflowStage } from "./workflow-state.js";
import type { WebsiteBlueprint } from "../schemas/blueprint.types.js";

export type AgentFn = (state: WorkflowState) => Promise<Partial<WebsiteBlueprint>>;

export interface AgentConfig {
  name: string;
  stage: WorkflowStage;
  run: AgentFn;
}

export interface AgentRunResult {
  result: AgentResult;
  output: Partial<WebsiteBlueprint>;
}

export async function runAgent(
  agent: AgentConfig,
  state: WorkflowState
): Promise<AgentRunResult> {
  const start = Date.now();

  try {
    const output = await agent.run(state);
    const durationMs = Date.now() - start;
    return {
      output,
      result: { stage: agent.stage, success: true, durationMs },
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    return {
      output: {},
      result: { stage: agent.stage, success: false, error, durationMs },
    };
  }
}
