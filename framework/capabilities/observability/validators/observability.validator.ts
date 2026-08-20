/**
 * Deterministic validation beyond the Zod shape check (task item 51) — same
 * {ok, issues} pattern as every prior validator. Unknown values are always
 * valid — only missing/incorrect references, fabricated thresholds, and
 * payload/secret exposure are errors.
 */

import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { AIAgentDefinition } from "../../ai-agents/schemas/ai-agents.types.js";
import type { SecurityArchitecture } from "../../security-governance/schemas/security-governance.types.js";
import type { ObservabilityArchitecture } from "../schemas/observability.types.js";
import { detectIdentifierCollisions } from "../../integrations/exporters/naming/typescript-identifier.js";

export interface ObservabilityValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ObservabilityValidationResult {
  ok: boolean;
  issues: ObservabilityValidationIssue[];
}

function checkUniqueIds(ids: string[], label: string): ObservabilityValidationIssue[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]): ObservabilityValidationIssue => ({ code: "duplicate-id", message: `${label} id "${id}" is used ${count} times`, severity: "error" }));
}

/** Not a real secret scanner — a deterministic reject-list guarding against Stitchfy itself accidentally embedding a credential-looking literal (same pattern Phase 5.5A's export validator already established). */
const SECRET_LITERAL_PATTERN = /\b(apiKey|api_key|password|clientSecret|client_secret|secret|token)\s*[:=]\s*["'][^"'\s]{4,}["']/i;

/** Business-payload-shaped attribute names must never appear — operational metadata and business content are different things (task items 12, 18, 53). */
const PAYLOAD_ATTRIBUTE_DENYLIST = new Set(["message", "response", "prompt", "body", "payload", "content", "conversation", "conversationcontent"]);

const THRESHOLD_PATTERN = /\b\d{1,3}(\.\d+)?\s?%|\b\d+(\.\d+)?\s?(ms|milliseconds?|seconds?|sec\b|minutes?|min\b)|\b\d+\s+consecutive\b/i;

export function validateObservabilityArchitecture(
  arch: ObservabilityArchitecture,
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  agents: AIAgentDefinition[],
  security: SecurityArchitecture
): ObservabilityValidationResult {
  const issues: ObservabilityValidationIssue[] = [];

  const workflowIds = new Set(workflows.map((w) => w.id));
  const workflowStepIds = new Set(workflows.flatMap((w) => w.steps.map((s) => s.id)));
  const integrationIds = new Set(integrations.map((i) => i.id));
  const systemIds = new Set(discovery.systems.map((s) => s.id));
  const agentIds = new Set(agents.map((a) => a.id));
  const toolIds = new Set(agents.flatMap((a) => a.tools.map((t) => t.id)));
  const approvalIds = new Set(workflows.flatMap((w) => w.approvals.map((a) => a.id)));
  const dataContractIds = new Set(integrations.flatMap((i) => i.dataContracts.map((c) => c.id)));
  const auditRequirementIds = new Set(security.auditRequirements.map((a) => a.id));

  const checkArchitectureRef = (ref: { entityType: string; entityId: string }, ownerLabel: string) => {
    const known: Record<string, Set<string>> = {
      workflow: workflowIds,
      "workflow-step": workflowStepIds,
      integration: integrationIds,
      system: systemIds,
      "data-contract": dataContractIds,
      approval: approvalIds,
      "ai-agent": agentIds,
      "ai-tool": toolIds,
    };
    const set = known[ref.entityType];
    if (set && !set.has(ref.entityId)) {
      issues.push({ code: "unknown-architecture-reference", message: `${ownerLabel} references unknown ${ref.entityType} "${ref.entityId}"`, severity: "error" });
    }
  };

  // Signal ownership + duplicate ids + collision
  issues.push(...checkUniqueIds(arch.signals.map((s) => s.id), "ObservabilitySignal"));
  const signalIds = new Set(arch.signals.map((s) => s.id));
  for (const signal of arch.signals) {
    checkArchitectureRef(signal.source, `Signal "${signal.id}"`);
    for (const a of signal.attributes) {
      if (PAYLOAD_ATTRIBUTE_DENYLIST.has(a.name.toLowerCase())) {
        issues.push({ code: "payload-attribute", message: `Signal "${signal.id}" declares payload-shaped attribute "${a.name}"`, severity: "error" });
      }
    }
  }
  const signalNameEntries = arch.signals.map((s) => ({ sourceName: s.id, identifier: s.name.trim().toLowerCase() }));
  for (const collision of detectIdentifierCollisions(signalNameEntries)) {
    issues.push({ code: "signal-name-collision", message: `Signals [${collision.sourceNames.join(", ")}] normalize to the same name "${collision.identifier}"`, severity: "error" });
  }

  // Telemetry/log requirements
  for (const req of arch.telemetryRequirements) {
    for (const ref of req.appliesTo) checkArchitectureRef(ref, `TelemetryRequirement "${req.id}"`);
    if (req.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `TelemetryRequirement "${req.id}" has no evidence references`, severity: "error" });
    }
  }
  for (const log of arch.logRequirements) {
    checkArchitectureRef(log.source, `LogRequirement "${log.id}"`);
    for (const f of log.fields) {
      if (PAYLOAD_ATTRIBUTE_DENYLIST.has(f.name.toLowerCase())) {
        issues.push({ code: "payload-attribute", message: `LogRequirement "${log.id}" declares payload-shaped field "${f.name}"`, severity: "error" });
      }
    }
    for (const artifactText of [log.event, ...log.prohibitedData]) {
      if (SECRET_LITERAL_PATTERN.test(artifactText)) {
        issues.push({ code: "possible-secret-literal", message: `LogRequirement "${log.id}" contains what looks like a credential literal`, severity: "error" });
      }
    }
  }

  // Metrics / health
  for (const metric of arch.metricRequirements) checkArchitectureRef(metric.source, `MetricRequirement "${metric.id}"`);
  for (const health of arch.healthRequirements) checkArchitectureRef(health.target, `HealthRequirement "${health.id}"`);

  // Correlation
  for (const c of arch.correlationRequirements) {
    for (const ref of c.architecturePath) checkArchitectureRef(ref, `CorrelationRequirement "${c.id}"`);
  }

  // Audit mappings
  for (const mapping of arch.auditMappings) {
    if (!auditRequirementIds.has(mapping.auditRequirementId)) {
      issues.push({ code: "unknown-audit-requirement", message: `AuditTelemetryMapping "${mapping.id}" references unknown audit requirement "${mapping.auditRequirementId}"`, severity: "error" });
    }
    if (mapping.signalIds.length === 0) {
      issues.push({ code: "empty-audit-mapping", message: `AuditTelemetryMapping "${mapping.id}" references no signals`, severity: "error" });
    }
    for (const id of mapping.signalIds) {
      if (!signalIds.has(id)) issues.push({ code: "unknown-signal", message: `AuditTelemetryMapping "${mapping.id}" references unknown signal "${id}"`, severity: "error" });
    }
  }

  // Alerts
  for (const alert of arch.alertRequirements) {
    for (const id of alert.sourceSignalIds) {
      if (!signalIds.has(id)) issues.push({ code: "unknown-signal", message: `AlertRequirement "${alert.id}" references unknown signal "${id}"`, severity: "error" });
    }
    if (alert.threshold && THRESHOLD_PATTERN.test(alert.threshold) && alert.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-threshold", message: `AlertRequirement "${alert.id}" has a concrete threshold with no supporting evidence`, severity: "error" });
    }
  }

  // Dashboards
  for (const dashboard of arch.dashboardSpecifications) {
    if (dashboard.signalIds.length === 0) {
      issues.push({ code: "empty-dashboard", message: `DashboardSpecification "${dashboard.id}" references no signals`, severity: "error" });
    }
    for (const id of dashboard.signalIds) {
      if (!signalIds.has(id)) issues.push({ code: "unknown-signal", message: `DashboardSpecification "${dashboard.id}" references unknown signal "${id}"`, severity: "error" });
    }
  }

  // Operational objectives — threshold provenance (task item 52)
  for (const objective of arch.operationalObjectives) {
    for (const ref of objective.target) checkArchitectureRef(ref, `OperationalObjective "${objective.id}"`);
    if (objective.targetValue && THRESHOLD_PATTERN.test(objective.targetValue) && objective.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-threshold", message: `OperationalObjective "${objective.id}" has a concrete target value with no supporting evidence`, severity: "error" });
    }
    if (objective.targetValue && !objective.explicit) {
      issues.push({ code: "derived-threshold", message: `OperationalObjective "${objective.id}" has a concrete target value but is marked derived, not explicit`, severity: "error" });
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
