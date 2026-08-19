/**
 * Deterministic validation beyond the Zod shape check (task item 23) —
 * same pattern as workflow-definition.validator.ts (Phase 3).
 */

import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { IntegrationDefinition } from "../schemas/integrations.types.js";

export interface IntegrationValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface IntegrationValidationResult {
  ok: boolean;
  issues: IntegrationValidationIssue[];
}

export function validateIntegrationDefinition(
  integration: IntegrationDefinition,
  discovery: DiscoveryResult,
  availableWorkflowIds?: string[]
): IntegrationValidationResult {
  const issues: IntegrationValidationIssue[] = [];

  const systemIds = new Set(discovery.systems.map((s) => s.id));
  const processIds = new Set(discovery.processes.map((p) => p.id));
  const requirementIds = new Set(discovery.requirements.map((r) => r.id));
  const contractIds = new Set(integration.dataContracts.map((c) => c.id));

  if (integration.sourceSystemId && !systemIds.has(integration.sourceSystemId)) {
    issues.push({ code: "unknown-system", message: `sourceSystemId "${integration.sourceSystemId}" not found in DiscoveryResult`, severity: "error" });
  }
  if (integration.targetSystemId && !systemIds.has(integration.targetSystemId)) {
    issues.push({ code: "unknown-system", message: `targetSystemId "${integration.targetSystemId}" not found in DiscoveryResult`, severity: "error" });
  }

  if (integration.sourceSystemId && integration.targetSystemId && integration.sourceSystemId === integration.targetSystemId) {
    issues.push({
      code: "same-system-boundary",
      message: `integration "${integration.id}" references the same system ("${integration.sourceSystemId}") as both source and target`,
      severity: "error",
    });
  }

  for (const id of integration.relatedProcessIds) {
    if (!processIds.has(id)) issues.push({ code: "unknown-process", message: `relatedProcessIds references unknown process "${id}"`, severity: "error" });
  }
  for (const id of integration.relatedRequirementIds) {
    if (!requirementIds.has(id)) issues.push({ code: "unknown-requirement", message: `relatedRequirementIds references unknown requirement "${id}"`, severity: "error" });
  }
  if (availableWorkflowIds) {
    const workflowIds = new Set(availableWorkflowIds);
    for (const id of integration.relatedWorkflowIds) {
      if (!workflowIds.has(id)) issues.push({ code: "unknown-workflow", message: `relatedWorkflowIds references unknown workflow "${id}"`, severity: "error" });
    }
  }

  for (const op of integration.operations) {
    if (op.requestContractId && !contractIds.has(op.requestContractId)) {
      issues.push({ code: "unknown-contract", message: `operation "${op.id}" requestContractId "${op.requestContractId}" does not exist`, severity: "error" });
    }
    if (op.responseContractId && !contractIds.has(op.responseContractId)) {
      issues.push({ code: "unknown-contract", message: `operation "${op.id}" responseContractId "${op.responseContractId}" does not exist`, severity: "error" });
    }
  }

  if (integration.evidenceRefs.length === 0) {
    issues.push({ code: "no-evidence", message: `integration "${integration.id}" has no evidence references`, severity: "error" });
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

/** Same (sourceSystemId, targetSystemId, purpose-normalized) combination appearing twice — task item 23. */
export function detectDuplicateIntegrations(integrations: IntegrationDefinition[]): IntegrationValidationIssue[] {
  const issues: IntegrationValidationIssue[] = [];
  const seen = new Map<string, string>();

  for (const integration of integrations) {
    const key = [
      integration.sourceSystemId ?? "unknown",
      integration.targetSystemId ?? "unknown",
      integration.purpose.trim().toLowerCase(),
    ].join("|");

    const existingId = seen.get(key);
    if (existingId) {
      issues.push({
        code: "duplicate-integration",
        message: `integration "${integration.id}" duplicates "${existingId}" (same source/target/purpose)`,
        severity: "error",
      });
    } else {
      seen.set(key, integration.id);
    }
  }

  return issues;
}
