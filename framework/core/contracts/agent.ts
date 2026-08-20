/**
 * Generic agent contract.
 *
 * Generalizes the website-pipeline-specific AgentFn/AgentConfig pattern in
 * framework/orchestrator/agent-runner.ts (which is bound to WorkflowState and
 * Partial<WebsiteBlueprint>) so the same "receive state, return output" shape
 * can be reused outside the blueprint pipeline — e.g. business discovery.
 */

export type AgentFn<TState, TOutput> = (state: TState) => Promise<TOutput>;

export interface Agent<TState, TOutput> {
  name: string;
  run: AgentFn<TState, TOutput>;
}
