/**
 * Deterministic validation beyond the Zod shape check (task item 38) —
 * same pattern as workflow-definition.validator.ts / integration-definition.validator.ts.
 * Unknown values are always valid here — only missing/incorrect references
 * and missing evidence are errors.
 */

import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { SecurityArchitecture, GovernancePlan } from "../schemas/security-governance.types.js";

export interface SecurityValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface SecurityValidationResult {
  ok: boolean;
  issues: SecurityValidationIssue[];
}

function checkUniqueIds(ids: string[], label: string): SecurityValidationIssue[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]): SecurityValidationIssue => ({
      code: "duplicate-id",
      message: `${label} id "${id}" is used ${count} times`,
      severity: "error",
    }));
}

export function validateSecurityArchitecture(
  security: SecurityArchitecture,
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[]
): SecurityValidationResult {
  const issues: SecurityValidationIssue[] = [];

  const systemIds = new Set(discovery.systems.map((s) => s.id));
  const processIds = new Set(discovery.processes.map((p) => p.id));
  const dataEntityIds = new Set(discovery.dataEntities.map((d) => d.id));
  const workflowIds = new Set(workflows.map((w) => w.id));
  const integrationIds = new Set(integrations.map((i) => i.id));
  const dataContractIds = new Set(integrations.flatMap((i) => i.dataContracts.map((c) => c.id)));
  const workflowStepIds = new Set(workflows.flatMap((w) => w.steps.map((s) => s.id)));
  const approvalIds = new Set(workflows.flatMap((w) => w.approvals.map((a) => a.id)));

  issues.push(...checkUniqueIds(security.requirements.map((r) => r.id), "SecurityRequirement"));
  issues.push(...checkUniqueIds(security.trustBoundaries.map((b) => b.id), "TrustBoundary"));
  issues.push(...checkUniqueIds(security.dataProtection.map((d) => d.id), "DataProtectionRequirement"));
  issues.push(...checkUniqueIds(security.identityAccess.map((r) => r.id), "IdentityAccessRequirement"));
  issues.push(...checkUniqueIds(security.auditRequirements.map((a) => a.id), "AuditRequirement"));
  issues.push(...checkUniqueIds(security.risks.map((r) => r.id), "RiskAssessment"));

  const checkArchitectureRef = (ref: { entityType: string; entityId: string }, ownerLabel: string) => {
    const known: Record<string, Set<string>> = {
      workflow: workflowIds,
      "workflow-step": workflowStepIds,
      integration: integrationIds,
      system: systemIds,
      "data-contract": dataContractIds,
      process: processIds,
      requirement: new Set(discovery.requirements.map((r) => r.id)),
      approval: approvalIds,
    };
    const set = known[ref.entityType];
    if (set && !set.has(ref.entityId)) {
      issues.push({
        code: "unknown-architecture-reference",
        message: `${ownerLabel} references unknown ${ref.entityType} "${ref.entityId}"`,
        severity: "error",
      });
    }
  };

  for (const r of security.requirements) {
    if (r.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `SecurityRequirement "${r.id}" has no evidence references`, severity: "error" });
    }
    for (const ref of r.appliesTo) checkArchitectureRef(ref, `SecurityRequirement "${r.id}"`);
  }

  for (const b of security.trustBoundaries) {
    if (b.sourceSystemId && b.sourceSystemId === b.targetSystemId) {
      issues.push({ code: "same-system-boundary", message: `TrustBoundary "${b.id}" references the same system as both source and target`, severity: "error" });
    }
    if (b.sourceSystemId && !systemIds.has(b.sourceSystemId)) {
      issues.push({ code: "unknown-system", message: `TrustBoundary "${b.id}" sourceSystemId "${b.sourceSystemId}" not found`, severity: "error" });
    }
    if (b.targetSystemId && !systemIds.has(b.targetSystemId)) {
      issues.push({ code: "unknown-system", message: `TrustBoundary "${b.id}" targetSystemId "${b.targetSystemId}" not found`, severity: "error" });
    }
    if (b.integrationId && !integrationIds.has(b.integrationId)) {
      issues.push({ code: "unknown-integration", message: `TrustBoundary "${b.id}" integrationId "${b.integrationId}" not found`, severity: "error" });
    }
    for (const id of b.dataContractIds) {
      if (!dataContractIds.has(id)) issues.push({ code: "unknown-data-contract", message: `TrustBoundary "${b.id}" references unknown data contract "${id}"`, severity: "error" });
    }
  }

  for (const d of security.dataProtection) {
    for (const id of d.dataEntityIds) {
      if (!dataEntityIds.has(id)) issues.push({ code: "unknown-data-entity", message: `DataProtectionRequirement "${d.id}" references unknown data entity "${id}"`, severity: "error" });
    }
    for (const id of d.dataContractIds) {
      if (!dataContractIds.has(id)) issues.push({ code: "unknown-data-contract", message: `DataProtectionRequirement "${d.id}" references unknown data contract "${id}"`, severity: "error" });
    }
  }

  for (const risk of security.risks) {
    if (risk.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `RiskAssessment "${risk.id}" has no evidence references`, severity: "error" });
    }
    for (const ref of risk.relatedArchitectureRefs) checkArchitectureRef(ref, `RiskAssessment "${risk.id}"`);
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

export function validateGovernancePlan(
  governance: GovernancePlan,
  workflows: WorkflowDefinition[]
): SecurityValidationResult {
  const issues: SecurityValidationIssue[] = [];
  const workflowIds = new Set(workflows.map((w) => w.id));
  const approvalIds = new Set(workflows.flatMap((w) => w.approvals.map((a) => a.id)));
  const decisionIds = new Set(workflows.flatMap((w) => w.decisions.map((d) => d.id)));

  issues.push(...checkUniqueIds(governance.humanOversight.map((c) => c.id), "GovernanceApprovalControl"));
  issues.push(...checkUniqueIds(governance.decisionControls.map((c) => c.id), "DecisionControl"));
  issues.push(...checkUniqueIds(governance.policies.map((p) => p.id), "GovernancePolicy"));
  issues.push(...checkUniqueIds(governance.complianceConsiderations.map((c) => c.id), "ComplianceConsideration"));

  for (const control of governance.humanOversight) {
    if (control.workflowId && !workflowIds.has(control.workflowId)) {
      issues.push({ code: "unknown-workflow", message: `GovernanceApprovalControl "${control.id}" references unknown workflow "${control.workflowId}"`, severity: "error" });
    }
    if (control.approvalId && !approvalIds.has(control.approvalId)) {
      issues.push({ code: "unknown-approval", message: `GovernanceApprovalControl "${control.id}" references unknown approval "${control.approvalId}"`, severity: "error" });
    }
  }

  for (const control of governance.decisionControls) {
    if (control.decisionId && !decisionIds.has(control.decisionId)) {
      issues.push({ code: "unknown-decision", message: `DecisionControl "${control.id}" references unknown decision "${control.decisionId}"`, severity: "error" });
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
