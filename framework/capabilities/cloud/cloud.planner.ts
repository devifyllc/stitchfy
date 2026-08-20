/**
 * CloudPlan — a lightweight planning-stage record of what will be inspected
 * (task item 12). The real CloudArchitecture is only built later, in
 * execute(), once WorkflowDefinition[]/IntegrationDefinition[]/
 * AIAgentDefinition[]/SecurityArchitecture/GovernancePlan/
 * ObservabilityArchitecture actually exist as sibling output.
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { makeIdGenerator } from "../../discovery/shared/section-lookup.js";
import type { CloudPlan, RuntimeCandidate } from "./schemas/cloud.types.js";

export function buildCloudPlan(context: SolutionContext, assessment: CapabilityAssessment): CloudPlan {
  const discovery = context.discoveryResult;

  if (!discovery || (assessment.status !== "recommended" && assessment.status !== "needs-review")) {
    return {
      deploymentNeedIds: [],
      relatedWorkflowIds: [],
      relatedIntegrationIds: [],
      relatedAgentIds: [],
      runtimeCandidates: [],
      explicitEnvironmentRequirements: [],
      securityRequirementIds: [],
      observabilityRequirementIds: [],
      informationGapIds: assessment.blockingGapIds,
      assumptions: [],
    };
  }

  const nextId = makeIdGenerator("RUNTIMECAND");

  const runtimeCandidates: RuntimeCandidate[] = [
    ...discovery.deploymentNeeds
      .filter((n) => n.category === "runtime" || n.category === "hosting" || n.category === "compute")
      .map((n): RuntimeCandidate => ({ id: nextId(), sourceKind: "deployment-need", sourceId: n.id, rationale: `Deployment need "${n.description}" describes a runtime/hosting concern.` })),
    ...discovery.aiAgentNeeds.map((n): RuntimeCandidate => ({ id: nextId(), sourceKind: "ai-agent", sourceId: n.id, rationale: `AI Agent Need "${n.id}" implies solution-owned orchestration logic requiring a runtime.` })),
  ];

  const explicitEnvironmentRequirements = discovery.deploymentNeeds.filter((n) => n.category === "environment").map((n) => n.id);

  return {
    deploymentNeedIds: discovery.deploymentNeeds.map((n) => n.id),
    relatedWorkflowIds: [],
    relatedIntegrationIds: [],
    relatedAgentIds: [],
    runtimeCandidates,
    explicitEnvironmentRequirements,
    securityRequirementIds: [],
    observabilityRequirementIds: [],
    informationGapIds: assessment.blockingGapIds,
    assumptions:
      runtimeCandidates.length > 0
        ? ["Real deployment units/runtime requirements are derived later from WorkflowDefinition[]/IntegrationDefinition[]/AIAgentDefinition[]/SecurityArchitecture/GovernancePlan/ObservabilityArchitecture, once available."]
        : [],
  };
}
