/**
 * AI-agent-specific governance controls (Phase 6, task item 33/34) —
 * cross-references the agent's own human-oversight entries (which already
 * reuse/reference the existing WorkflowApproval model) rather than
 * duplicating an approval domain. Never a blanket "every write tool always
 * requires approval" rule — only the agent's own already-derived evidence.
 */

import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type { AIAgentDefinition } from "../../ai-agents/schemas/ai-agents.types.js";
import type { AIAgentGovernanceControl } from "../schemas/security-governance.types.js";

function agentRef(agentId: string): ArchitectureReference {
  return { entityType: "ai-agent", entityId: agentId };
}
function toolRef(toolId: string): ArchitectureReference {
  return { entityType: "ai-tool", entityId: toolId };
}

export function buildAIAgentGovernanceControls(agents: AIAgentDefinition[]): AIAgentGovernanceControl[] {
  const nextId = makeIdGenerator("AIGOVCTRL");
  const controls: AIAgentGovernanceControl[] = [];

  for (const agent of agents) {
    for (const oversight of agent.humanOversight) {
      controls.push({
        id: nextId(),
        agentId: agent.id,
        type: "human-approval",
        description: `Agent "${agent.name}" must not act on "${oversight.reason}" without the existing approval control (\`${oversight.approval.id}\`) being satisfied — the agent may not bypass this approval point.`,
        appliesTo: [agentRef(agent.id)],
        evidenceRefs: oversight.evidenceRefs,
      });
    }

    for (const tool of agent.tools.filter((t) => t.sideEffect === "write" || t.sideEffect === "notify")) {
      controls.push({
        id: nextId(),
        agentId: agent.id,
        type: "tool-invocation",
        description: `Agent "${agent.name}" may invoke tool "${tool.name}" only within its evidenced scope; the tool's existence does not itself grant the agent authority beyond what was explicitly permitted.`,
        appliesTo: [agentRef(agent.id), toolRef(tool.id)],
        evidenceRefs: tool.evidenceRefs,
      });
    }

    if (agent.memory.mode === "persistent") {
      controls.push({
        id: nextId(),
        agentId: agent.id,
        type: "memory",
        description: `Agent "${agent.name}"'s persistent memory should be reviewed for retention and access controls before implementation.`,
        appliesTo: [agentRef(agent.id)],
        evidenceRefs: agent.memory.evidenceRefs,
      });
    }
  }

  return controls;
}
