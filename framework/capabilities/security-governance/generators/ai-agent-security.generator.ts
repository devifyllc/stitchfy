/**
 * AI-agent-specific security requirements/risks (Phase 6, task item 32).
 * Consumes AIAgentDefinition[] as-is — never regenerates agent architecture,
 * only creates security requirements/risks/gaps referencing it. Read-only
 * tools never receive a write-control requirement (directly tested);
 * session-only memory with no sensitive-data evidence never receives a
 * persistent-storage/data-protection requirement (directly tested).
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { RiskAssessment } from "../../../planning/risk-assessment/risk-assessment.types.js";
import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type { AIAgentDefinition } from "../../ai-agents/schemas/ai-agents.types.js";
import type { SecurityRequirement, InformationGapReference } from "../schemas/security-governance.types.js";

function agentRef(agentId: string): ArchitectureReference {
  return { entityType: "ai-agent", entityId: agentId };
}
function toolRef(toolId: string): ArchitectureReference {
  return { entityType: "ai-tool", entityId: toolId };
}

export interface AIAgentSecurityResult {
  requirements: SecurityRequirement[];
  risks: RiskAssessment[];
  informationGaps: InformationGapReference[];
}

export function buildAIAgentSecurityRequirements(agents: AIAgentDefinition[]): AIAgentSecurityResult {
  const ids = {
    requirement: makeIdGenerator("AISECREQ"),
    risk: makeIdGenerator("AIRISK"),
    gap: makeIdGenerator("AISECGAP"),
  };

  const requirements: SecurityRequirement[] = [];
  const risks: RiskAssessment[] = [];
  const informationGaps: InformationGapReference[] = [];

  for (const agent of agents) {
    const sideEffectingTools = agent.tools.filter((t) => t.sideEffect === "write" || t.sideEffect === "notify");

    for (const tool of sideEffectingTools) {
      const evidenceRefs: EvidenceReference[] = tool.evidenceRefs;

      requirements.push({
        id: ids.requirement(),
        domain: "authorization",
        description: `Tool "${tool.name}" on agent "${agent.name}" can modify external state; authorization for who may trigger it should be defined and confirmed before implementation.`,
        priority: "review",
        appliesTo: [agentRef(agent.id), toolRef(tool.id)],
        evidenceRefs,
        status: tool.approvalRequired === true ? "defined" : "needs-information",
      });

      requirements.push({
        id: ids.requirement(),
        domain: "audit",
        description: `Invocations of tool "${tool.name}" by agent "${agent.name}" should be auditable.`,
        priority: "review",
        appliesTo: [agentRef(agent.id), toolRef(tool.id)],
        evidenceRefs,
        status: "defined",
      });

      if (tool.approvalRequired !== true) {
        risks.push({
          id: ids.risk(),
          category: "security",
          description: `Agent "${agent.name}" has a side-effecting tool ("${tool.name}") without a confirmed approval control.`,
          likelihood: "unknown",
          impact: "unknown",
          treatment: "review",
          relatedArchitectureRefs: [agentRef(agent.id), toolRef(tool.id)],
          evidenceRefs,
          status: "needs-review",
        });
      }
    }

    // Memory — never inferred persistent-storage controls for session-only
    // memory with no known sensitive data (task item 35).
    if (agent.memory.mode === "persistent" && agent.memory.containsSensitiveData !== false) {
      requirements.push({
        id: ids.requirement(),
        domain: "data-protection",
        description: `Agent "${agent.name}" retains persistent memory that may contain sensitive data; data protection, retention, access, and audit requirements should be evaluated.`,
        priority: "review",
        appliesTo: [agentRef(agent.id)],
        evidenceRefs: agent.memory.evidenceRefs,
        status: "needs-information",
      });
    }

    // Model/provider data-handling gap — only when the agent actually has a
    // non-public/sensitive data surface (memory or a tool's data contract);
    // never a blanket gap merely because a provider hasn't been chosen
    // (task item 32's "only when materially required").
    const hasDataSurface =
      agent.memory.containsSensitiveData === true ||
      agent.memory.containsSensitiveData === "unknown" ||
      agent.inputContracts.some((c) => c.dataEntityIds.length > 0 || c.integrationDataContractIds.length > 0);

    if (!agent.modelRequirements.provider && !agent.modelRequirements.model && hasDataSurface) {
      informationGaps.push({
        gapId: ids.gap(),
        topic: "AI provider data handling",
        question: `May data handled by agent "${agent.name}" be sent to an external AI model provider? No provider has been selected yet.`,
        isNew: true,
      });
    }
  }

  return { requirements, risks, informationGaps };
}
