/**
 * AIAgentNeed — Discovery's explicit record of *why* an AI Agent is being
 * considered, captured only from a dedicated "AI Agent Needs" section (see
 * ai-agent-needs.extractor.ts). Never inferred from "Automation"/"Workflow"/
 * "Integration" language elsewhere (task item 4) — those drive Workflow
 * Automation's own signals, not this one.
 *
 * `tasks` captures every bullet verbatim, positive and negative alike —
 * Discovery's job is capture, not interpretation. Guardrail/permission
 * derivation from negative ("must not") statements happens later, in
 * framework/capabilities/ai-agents/generators/ai-agent-definition.generator.ts.
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export type AICapabilityNeed =
  | "conversation"
  | "generation"
  | "summarization"
  | "classification"
  | "extraction"
  | "decision-support"
  | "tool-use"
  | "retrieval"
  | "orchestration"
  | "unknown";

export interface AIAgentNeed {
  id: string;
  name: string;
  purpose: string;

  actorIds: string[];

  tasks: string[];

  relatedProcessIds: string[];
  relatedRequirementIds: string[];
  relatedOutcomeIds: string[];

  desiredCapabilities: AICapabilityNeed[];

  humanOversightRequired: true | false | "unknown";

  metadata: DiscoveryMetadata;
}
