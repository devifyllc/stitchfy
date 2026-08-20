/**
 * Deterministic validation beyond the Zod shape check — same {ok, issues}
 * pattern as every prior validator. Unknown values are always valid — only
 * missing/incorrect references, unsupported concrete values, and fabricated
 * technology (provider services, network implementation) are errors.
 */

import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { AIAgentDefinition } from "../../ai-agents/schemas/ai-agents.types.js";
import type { SecurityArchitecture } from "../../security-governance/schemas/security-governance.types.js";
import type { ObservabilityArchitecture } from "../../observability/schemas/observability.types.js";
import type { CloudArchitecture, CloudEndpointReference } from "../schemas/cloud.types.js";

export interface CloudValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface CloudValidationResult {
  ok: boolean;
  issues: CloudValidationIssue[];
}

function checkUniqueIds(ids: string[], label: string): CloudValidationIssue[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]): CloudValidationIssue => ({ code: "duplicate-id", message: `${label} id "${id}" is used ${count} times`, severity: "error" }));
}

/** Defense-in-depth regression guard, not an exhaustive vendor catalog — Phase 7B never selects a specific compute/database/queue service. */
const PROVIDER_SERVICE_DENYLIST =
  /\b(Lambda|ECS|EKS|Fargate|EC2|RDS|DynamoDB|S3|SQS|AKS|App Service|Cosmos DB|Azure Functions|GKE|Cloud Run|Cloud Functions|Firestore|Pub\/?Sub)\b/;

/** Defense-in-depth regression guard — Phase 7B never invents a network implementation. */
const NETWORK_IMPLEMENTATION_DENYLIST = /\b(VPC|subnet|NAT gateway|security group|load balancer|private link|route table|internet gateway)\b/i;

const CONCRETE_VALUE_PATTERN = /\b\d{1,3}(\.\d+)?\s?%|\b\d+\s+concurrent\b|\b\d+\/\w+\b/i;

function collectStrings(arch: CloudArchitecture): string[] {
  const strings: string[] = [];
  for (const u of arch.deploymentUnits) strings.push(u.name);
  for (const r of arch.runtimeRequirements) strings.push(r.description);
  for (const s of arch.stateRequirements) strings.push(s.purpose);
  for (const p of arch.persistenceRequirements) strings.push(p.purpose);
  for (const c of arch.connectivityRequirements) strings.push(c.source.label, c.target.label);
  for (const e of arch.environmentRequirements) strings.push(e.name);
  for (const s of arch.scalabilityRequirements) strings.push(s.requirement ?? "");
  for (const r of arch.resilienceRequirements) strings.push(r.description);
  return strings;
}

function endpointKey(e: CloudEndpointReference): string {
  return e.entityId ? `${e.kind}:${e.entityId}` : `${e.kind}:${e.label}`;
}

export function validateCloudArchitecture(
  arch: CloudArchitecture,
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  agents: AIAgentDefinition[],
  security: SecurityArchitecture,
  observability: ObservabilityArchitecture
): CloudValidationResult {
  const issues: CloudValidationIssue[] = [];

  const workflowIds = new Set(workflows.map((w) => w.id));
  const integrationIds = new Set(integrations.map((i) => i.id));
  const agentIds = new Set(agents.map((a) => a.id));
  const systemIds = new Set(discovery.systems.map((s) => s.id));
  const securityRequirementIds = new Set(security.requirements.map((r) => r.id));
  const observabilityIds = new Set([
    ...observability.signals.map((s) => s.id),
    ...observability.healthRequirements.map((h) => h.id),
    ...observability.operationalObjectives.map((o) => o.id),
  ]);
  const deploymentUnitIds = new Set(arch.deploymentUnits.map((u) => u.id));
  const stateRequirementIds = new Set(arch.stateRequirements.map((s) => s.id));
  const connectivityRequirementIds = new Set(arch.connectivityRequirements.map((c) => c.id));

  issues.push(...checkUniqueIds(arch.deploymentUnits.map((u) => u.id), "DeploymentUnit"));
  issues.push(...checkUniqueIds(arch.runtimeRequirements.map((r) => r.id), "RuntimeRequirement"));
  issues.push(...checkUniqueIds(arch.stateRequirements.map((s) => s.id), "StateRequirement"));
  issues.push(...checkUniqueIds(arch.persistenceRequirements.map((p) => p.id), "PersistenceRequirement"));
  issues.push(...checkUniqueIds(arch.connectivityRequirements.map((c) => c.id), "ConnectivityRequirement"));
  issues.push(...checkUniqueIds(arch.environmentRequirements.map((e) => e.id), "EnvironmentRequirement"));

  const checkArchitectureRef = (ref: { entityType: string; entityId: string }, ownerLabel: string) => {
    const known: Record<string, Set<string>> = {
      workflow: workflowIds,
      integration: integrationIds,
      "ai-agent": agentIds,
      system: systemIds,
      "deployment-unit": deploymentUnitIds,
    };
    const set = known[ref.entityType];
    if (set && !set.has(ref.entityId)) {
      issues.push({ code: "unknown-architecture-reference", message: `${ownerLabel} references unknown ${ref.entityType} "${ref.entityId}"`, severity: "error" });
    }
  };

  // Deployment-unit-ownership: an explicitly external system id can never be a deployment unit's own id.
  for (const unit of arch.deploymentUnits) {
    if (systemIds.has(unit.id)) {
      issues.push({ code: "external-system-as-deployment-unit", message: `DeploymentUnit "${unit.id}" reuses an external SystemInventoryItem id`, severity: "error" });
    }
    for (const ref of unit.sourceArchitectureRefs) checkArchitectureRef(ref, `DeploymentUnit "${unit.id}"`);
  }

  for (const req of arch.runtimeRequirements) {
    for (const ref of req.appliesTo) checkArchitectureRef(ref, `RuntimeRequirement "${req.id}"`);
    if (req.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `RuntimeRequirement "${req.id}" has no evidence references`, severity: "error" });
    }
  }

  for (const state of arch.stateRequirements) {
    for (const ref of state.appliesTo) checkArchitectureRef(ref, `StateRequirement "${state.id}"`);
    if (state.mode !== "unknown" && state.mode !== "none" && state.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `StateRequirement "${state.id}" declares a concrete mode with no evidence`, severity: "error" });
    }
  }

  for (const persist of arch.persistenceRequirements) {
    if (persist.technology !== "unspecified") {
      issues.push({ code: "fabricated-technology", message: `PersistenceRequirement "${persist.id}" specifies a technology; Phase 7B must keep this "unspecified"`, severity: "error" });
    }
    if (persist.consistency !== "unknown" && persist.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `PersistenceRequirement "${persist.id}" declares consistency without evidence`, severity: "error" });
    }
  }

  // Connectivity — source/target resolve, no identical known source=target.
  for (const conn of arch.connectivityRequirements) {
    for (const endpoint of [conn.source, conn.target]) {
      if (endpoint.kind === "deployment-unit" && endpoint.entityId && !deploymentUnitIds.has(endpoint.entityId)) {
        issues.push({ code: "unknown-endpoint", message: `ConnectivityRequirement "${conn.id}" references unknown deployment unit "${endpoint.entityId}"`, severity: "error" });
      }
      if (endpoint.kind === "external-system" && endpoint.entityId && !systemIds.has(endpoint.entityId)) {
        issues.push({ code: "unknown-endpoint", message: `ConnectivityRequirement "${conn.id}" references unknown external system "${endpoint.entityId}"`, severity: "error" });
      }
    }
    if (conn.source.kind !== "unknown" && conn.target.kind !== "unknown" && endpointKey(conn.source) === endpointKey(conn.target)) {
      issues.push({ code: "self-connectivity", message: `ConnectivityRequirement "${conn.id}" has an identical known source and target`, severity: "error" });
    }
    if (conn.integrationId && !integrationIds.has(conn.integrationId)) {
      issues.push({ code: "unknown-integration", message: `ConnectivityRequirement "${conn.id}" references unknown integration "${conn.integrationId}"`, severity: "error" });
    }
    if (conn.exposure === "public" && conn.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `ConnectivityRequirement "${conn.id}" marks exposure public with no evidence`, severity: "error" });
    }
  }

  // Provider / location / scaling / environment / deployment-strategy provenance.
  if (arch.providerRequirement.provider !== "unspecified" && arch.providerRequirement.evidenceRefs.length === 0) {
    issues.push({ code: "unsupported-provider", message: `Provider "${arch.providerRequirement.provider}" has no supporting evidence`, severity: "error" });
  }
  if (arch.locationRequirement && arch.locationRequirement.explicit && arch.locationRequirement.evidenceRefs.length === 0) {
    issues.push({ code: "unsupported-location", message: "LocationRequirement is marked explicit with no supporting evidence", severity: "error" });
  }
  for (const scale of arch.scalabilityRequirements) {
    if (scale.explicit && scale.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-scalability", message: `ScalabilityRequirement "${scale.id}" is marked explicit with no supporting evidence`, severity: "error" });
    }
    if (scale.requirement && CONCRETE_VALUE_PATTERN.test(scale.requirement) && !scale.explicit) {
      issues.push({ code: "derived-scalability", message: `ScalabilityRequirement "${scale.id}" has a concrete value but is not marked explicit`, severity: "error" });
    }
  }
  for (const env of arch.environmentRequirements) {
    if (env.evidenceRefs.length === 0) {
      issues.push({ code: "no-evidence", message: `EnvironmentRequirement "${env.id}" has no evidence references`, severity: "error" });
    }
  }
  if (arch.deploymentStrategy && arch.deploymentStrategy.explicit && arch.deploymentStrategy.evidenceRefs.length === 0) {
    issues.push({ code: "unsupported-deployment-strategy", message: "DeploymentStrategyRequirement is marked explicit with no supporting evidence", severity: "error" });
  }

  // Security / observability mappings — pure reference layer.
  for (const mapping of arch.securityMappings) {
    if (!securityRequirementIds.has(mapping.securityRequirementId)) {
      issues.push({ code: "unknown-security-requirement", message: `CloudSecurityMapping "${mapping.id}" references unknown security requirement "${mapping.securityRequirementId}"`, severity: "error" });
    }
    for (const id of mapping.deploymentUnitIds) {
      if (!deploymentUnitIds.has(id)) issues.push({ code: "unknown-deployment-unit", message: `CloudSecurityMapping "${mapping.id}" references unknown deployment unit "${id}"`, severity: "error" });
    }
    for (const id of mapping.connectivityRequirementIds) {
      if (!connectivityRequirementIds.has(id)) issues.push({ code: "unknown-connectivity-requirement", message: `CloudSecurityMapping "${mapping.id}" references unknown connectivity requirement "${id}"`, severity: "error" });
    }
    for (const id of mapping.stateRequirementIds) {
      if (!stateRequirementIds.has(id)) issues.push({ code: "unknown-state-requirement", message: `CloudSecurityMapping "${mapping.id}" references unknown state requirement "${id}"`, severity: "error" });
    }
  }
  for (const mapping of arch.observabilityMappings) {
    if (!deploymentUnitIds.has(mapping.deploymentUnitId)) {
      issues.push({ code: "unknown-deployment-unit", message: `CloudObservabilityMapping "${mapping.id}" references unknown deployment unit "${mapping.deploymentUnitId}"`, severity: "error" });
    }
    for (const id of [...mapping.telemetryRequirementIds, ...mapping.healthRequirementIds, ...mapping.operationalObjectiveIds]) {
      if (!observabilityIds.has(id)) {
        issues.push({ code: "unknown-observability-reference", message: `CloudObservabilityMapping "${mapping.id}" references unknown observability id "${id}"`, severity: "error" });
      }
    }
  }

  // Technology fabrication denylists.
  for (const text of collectStrings(arch)) {
    if (PROVIDER_SERVICE_DENYLIST.test(text)) {
      issues.push({ code: "fabricated-provider-service", message: `Cloud architecture text mentions a specific provider service: "${text}"`, severity: "error" });
    }
    if (NETWORK_IMPLEMENTATION_DENYLIST.test(text)) {
      issues.push({ code: "fabricated-network-implementation", message: `Cloud architecture text mentions a specific network implementation: "${text}"`, severity: "error" });
    }
  }

  // Microservice restraint: multiple Workflow/Integration/AIAgent objects must not automatically become multiple deployment units unless each has real, distinct evidence.
  const evidencedUnitCount = arch.deploymentUnits.filter((u) => u.evidenceRefs.length > 0).length;
  if (evidencedUnitCount !== arch.deploymentUnits.length) {
    issues.push({ code: "unsupported-deployment-unit", message: "A DeploymentUnit exists without supporting evidence", severity: "error" });
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
