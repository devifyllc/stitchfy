/**
 * Deterministic validation beyond the Zod shape check (task item 48) — same
 * {ok, issues} pattern as every other validator in this codebase. Unknown
 * values are always valid — only missing/incorrect references, invented
 * permissions, and fabricated numeric confidence are errors.
 */

import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { AIAgentDefinition } from "../schemas/ai-agents.types.js";
import { detectIdentifierCollisions } from "../../integrations/exporters/naming/typescript-identifier.js";

export interface AgentValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface AgentValidationResult {
  ok: boolean;
  issues: AgentValidationIssue[];
}

function checkUniqueIds(ids: string[], label: string): AgentValidationIssue[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]): AgentValidationIssue => ({ code: "duplicate-id", message: `${label} id "${id}" is used ${count} times`, severity: "error" }));
}

export function validateAIAgentDefinition(
  agent: AIAgentDefinition,
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[]
): AgentValidationResult {
  const issues: AgentValidationIssue[] = [];

  const needIds = new Set(discovery.aiAgentNeeds.map((n) => n.id));
  const processIds = new Set(discovery.processes.map((p) => p.id));
  const requirementIds = new Set(discovery.requirements.map((r) => r.id));
  const workflowIds = new Set(workflows.map((w) => w.id));
  const workflowStepIds = new Set(workflows.flatMap((w) => w.steps.map((s) => s.id)));
  const integrationIds = new Set(integrations.map((i) => i.id));
  const operationIds = new Set(integrations.flatMap((i) => i.operations.map((o) => o.id)));

  for (const id of agent.relatedNeedIds) {
    if (!needIds.has(id)) issues.push({ code: "unknown-need", message: `Agent "${agent.id}" references unknown AI Agent Need "${id}"`, severity: "error" });
  }
  for (const id of agent.relatedProcessIds) {
    if (!processIds.has(id)) issues.push({ code: "unknown-process", message: `Agent "${agent.id}" references unknown process "${id}"`, severity: "error" });
  }
  for (const id of agent.relatedRequirementIds) {
    if (!requirementIds.has(id)) issues.push({ code: "unknown-requirement", message: `Agent "${agent.id}" references unknown requirement "${id}"`, severity: "error" });
  }
  for (const id of agent.relatedWorkflowIds) {
    if (!workflowIds.has(id)) issues.push({ code: "unknown-workflow", message: `Agent "${agent.id}" references unknown workflow "${id}"`, severity: "error" });
  }
  for (const id of agent.relatedIntegrationIds) {
    if (!integrationIds.has(id)) issues.push({ code: "unknown-integration", message: `Agent "${agent.id}" references unknown integration "${id}"`, severity: "error" });
  }

  issues.push(...checkUniqueIds(agent.tools.map((t) => t.id), "AIAgentToolSpecification"));
  issues.push(...checkUniqueIds(agent.permissions.map((p) => p.id), "AIAgentPermission"));
  issues.push(...checkUniqueIds(agent.guardrails.map((g) => g.id), "AIAgentGuardrail"));

  const toolNameEntries = agent.tools.map((t) => ({ sourceName: t.id, identifier: t.name.trim().toLowerCase() }));
  for (const collision of detectIdentifierCollisions(toolNameEntries)) {
    issues.push({ code: "tool-name-collision", message: `Tools [${collision.sourceNames.join(", ")}] normalize to the same name "${collision.identifier}"`, severity: "error" });
  }

  const knownToolIds = new Set(agent.tools.map((t) => t.id));

  for (const tool of agent.tools) {
    if (tool.integrationId && !integrationIds.has(tool.integrationId)) {
      issues.push({ code: "unknown-integration", message: `Tool "${tool.id}" references unknown integration "${tool.integrationId}"`, severity: "error" });
    }
    if (tool.integrationOperationId && !operationIds.has(tool.integrationOperationId)) {
      issues.push({ code: "unknown-operation", message: `Tool "${tool.id}" references unknown integration operation "${tool.integrationOperationId}"`, severity: "error" });
    }
    if (tool.workflowId && !workflowIds.has(tool.workflowId)) {
      issues.push({ code: "unknown-workflow", message: `Tool "${tool.id}" references unknown workflow "${tool.workflowId}"`, severity: "error" });
    }
    if (tool.workflowStepId && !workflowStepIds.has(tool.workflowStepId)) {
      issues.push({ code: "unknown-workflow-step", message: `Tool "${tool.id}" references unknown workflow step "${tool.workflowStepId}"`, severity: "error" });
    }
    if ((tool.sideEffect === "write" || tool.sideEffect === "notify") && tool.approvalRequired === true) {
      const referenced = agent.humanOversight.some((o) => o.appliesToToolIds.includes(tool.id));
      if (!referenced) {
        issues.push({ code: "unreferenced-approval-required-tool", message: `Tool "${tool.id}" requires approval but no HumanApprovalRequest applies to it`, severity: "warning" });
      }
    }
  }

  for (const permission of agent.permissions) {
    for (const ref of permission.appliesTo) {
      if (ref.entityType === "ai-tool" && !knownToolIds.has(ref.entityId)) {
        issues.push({ code: "unknown-tool", message: `Permission "${permission.id}" references unknown tool "${ref.entityId}"`, severity: "error" });
      }
    }
    if (permission.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `Permission "${permission.id}" has no evidence references — no permission should be invented`, severity: "error" });
    }
  }

  for (const oversight of agent.humanOversight) {
    if (!oversight.approval) {
      issues.push({ code: "missing-approval", message: `Human oversight "${oversight.id}" has no HumanApprovalRequest`, severity: "error" });
    } else if (oversight.approval.decision !== "pending") {
      issues.push({ code: "auto-decided-approval", message: `Human oversight "${oversight.id}" must not be pre-decided (found "${oversight.approval.decision}")`, severity: "error" });
    }
  }
  for (const id of agent.memory.dataEntityIds) {
    if (!discovery.dataEntities.some((d) => d.id === id)) {
      issues.push({ code: "unknown-data-entity", message: `Memory strategy references unknown data entity "${id}"`, severity: "error" });
    }
  }

  if (agent.confidencePolicy.threshold !== undefined && agent.confidencePolicy.evidenceRefs.length === 0) {
    issues.push({ code: "unsupported-confidence-threshold", message: `Agent "${agent.id}" has a numeric confidence threshold with no supporting evidence`, severity: "error" });
  }

  for (const gap of agent.informationGaps) {
    if (!gap.relatedCapabilityIds.includes("ai-agents")) {
      issues.push({ code: "unscoped-gap", message: `Information gap "${gap.id}" is not scoped to ai-agents`, severity: "warning" });
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

/** Every generated tool must belong to at least one agent (task item 48 — no orphan tools) — checked at the section level since it spans all agents. */
export function detectOrphanTools(agents: AIAgentDefinition[], toolCatalog: { id: string }[]): AgentValidationIssue[] {
  const referencedToolIds = new Set(agents.flatMap((a) => a.tools.map((t) => t.id)));
  return toolCatalog
    .filter((t) => !referencedToolIds.has(t.id))
    .map((t) => ({ code: "orphan-tool", message: `Tool "${t.id}" in the catalog belongs to no agent`, severity: "error" as const }));
}
