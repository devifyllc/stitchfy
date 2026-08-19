/**
 * ObservabilityPlan — a lightweight planning-stage record of what will be
 * inspected (task item 7). The real TelemetryRequirement/ObservabilitySignal
 * objects are only built later, in execute(), once WorkflowDefinition[]/
 * IntegrationDefinition[]/AIAgentDefinition[] actually exist as sibling
 * output — this plan only lists candidate sources and evidence, it doesn't
 * pre-empt the generator's own decisions.
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { makeIdGenerator } from "../../discovery/shared/section-lookup.js";
import type { ObservabilityPlan, TelemetryCandidate } from "./schemas/observability.types.js";

export function buildObservabilityPlan(context: SolutionContext, assessment: CapabilityAssessment): ObservabilityPlan {
  const discovery = context.discoveryResult;

  if (!discovery || (assessment.status !== "recommended" && assessment.status !== "needs-review")) {
    return {
      workflowIds: [],
      integrationIds: [],
      agentIds: [],
      securityRequirementIds: [],
      auditRequirementIds: [],
      telemetryCandidates: [],
      explicitOperationalRequirementIds: [],
      informationGapIds: assessment.blockingGapIds,
      assumptions: [],
    };
  }

  const nextId = makeIdGenerator("TELCAND");

  const telemetryCandidates: TelemetryCandidate[] = [
    ...discovery.processes
      .filter((p) => p.steps.length >= 2)
      .map((p): TelemetryCandidate => ({ id: nextId(), sourceKind: "workflow", sourceId: p.id, rationale: `Process "${p.name}" is likely to produce a WorkflowDefinition worth observing.` })),
    ...discovery.integrationNeeds.map((n): TelemetryCandidate => ({ id: nextId(), sourceKind: "integration", sourceId: n.id, rationale: `Integration need "${n.description}" is likely to produce an external-boundary operation.` })),
    ...discovery.aiAgentNeeds.map((n): TelemetryCandidate => ({ id: nextId(), sourceKind: "ai-agent", sourceId: n.id, rationale: `AI Agent Need "${n.id}" is likely to produce agent/tool operational visibility needs.` })),
  ];

  const explicitOperationalRequirementIds = assessment.reasons
    .filter((r) => r.code === "explicit-operational-requirement")
    .flatMap((r) => r.evidenceRefs.filter((e) => e.entityType === "requirement").map((e) => e.entityId));

  return {
    workflowIds: [],
    integrationIds: [],
    agentIds: [],
    securityRequirementIds: [],
    auditRequirementIds: [],
    telemetryCandidates,
    explicitOperationalRequirementIds,
    informationGapIds: assessment.blockingGapIds,
    assumptions:
      telemetryCandidates.length > 0
        ? ["Real telemetry requirements/signals are derived later from WorkflowDefinition[]/IntegrationDefinition[]/AIAgentDefinition[], once available."]
        : [],
  };
}
