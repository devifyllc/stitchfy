/**
 * Cloud Architecture capability — migrated off Phase 0's keyword list
 * (cloud/aws/azure/gcp/scal/deploy/infrastructure) and its mandatory
 * provider/NetworkingConfig/DatabaseResource skeleton (Phase 7B).
 * supports()/assess() delegate to assessCloud(). execute() reads Workflow
 * Automation's, Integrations', AI Agents', Security & Governance's, and
 * Observability's sibling output (registry order places all five before
 * cloud — see docs/architecture/ARCHITECTURE.md "Vendor-Neutral Cloud and
 * Deployment Architecture") to build an evidence-backed CloudArchitecture.
 * `implemented: true` means Stitchfy generated and validated a vendor-
 * neutral cloud/deployment architecture for the currently known solution —
 * never that infrastructure was provisioned or CloudProvider.deploy() ran.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessCloud, CLOUD_CAPABILITY_ID } from "./cloud.assessor.js";
import { buildCloudPlan } from "./cloud.planner.js";
import { buildCloudArchitecture } from "./generators/cloud-architecture.generator.js";
import { buildCloudArtifacts } from "./generators/cloud-artifact.generator.js";
import { validateCloudArchitecture } from "./validators/cloud.validator.js";
import type { CloudArchitectureSection, CloudArchitecture } from "./schemas/cloud.types.js";
import type { WorkflowAutomationSection } from "../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationsSection } from "../integrations/schemas/integrations.types.js";
import type { AIAgentsSection } from "../ai-agents/schemas/ai-agents.types.js";
import type { SecurityGovernanceOutput } from "../security-governance/schemas/security-governance.types.js";
import type { ObservabilitySection, ObservabilityArchitecture } from "../observability/schemas/observability.types.js";

function supports(context: SolutionContext): boolean {
  const assessment = assessCloud(context);
  return assessment.status === "recommended" || assessment.status === "needs-review";
}

function assess(context: SolutionContext): CapabilityAssessment {
  return assessCloud(context);
}

async function plan(context: SolutionContext): Promise<CapabilityAssessment> {
  return assessCloud(context);
}

function siblingOutput<T>(context: SolutionContext, capabilityId: string): T | undefined {
  return context.capabilityResults.find((r) => r.capabilityId === capabilityId)?.output as T | undefined;
}

const EMPTY_ARCHITECTURE: CloudArchitecture = {
  version: "1.0",
  hostingModel: "unknown",
  providerRequirement: { provider: "unspecified", explicit: false, evidenceRefs: [] },
  deploymentUnits: [],
  runtimeRequirements: [],
  stateRequirements: [],
  persistenceRequirements: [],
  connectivityRequirements: [],
  environmentRequirements: [],
  scalabilityRequirements: [],
  resilienceRequirements: [],
  securityMappings: [],
  observabilityMappings: [],
  informationGaps: [],
  evidenceRefs: [],
  status: "draft",
  statusReasons: [],
};

const EMPTY_OBSERVABILITY_ARCHITECTURE: ObservabilityArchitecture = {
  version: "1.0",
  telemetryRequirements: [],
  signals: [],
  logRequirements: [],
  metricRequirements: [],
  correlationRequirements: [],
  healthRequirements: [],
  alertRequirements: [],
  dashboardSpecifications: [],
  auditMappings: [],
  operationalObjectives: [],
  informationGaps: [],
  evidenceRefs: [],
  status: "draft",
  statusReasons: [],
};

async function execute(assessment: CapabilityAssessment, context: SolutionContext): Promise<CloudArchitectureSection> {
  const cloudPlan = buildCloudPlan(context, assessment);
  const discovery = context.discoveryResult;

  const notes: string[] = [
    `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
    ...assessment.reasons.map((r) => r.description),
  ];

  if (!discovery) {
    notes.push("No discovery result available to analyze.");
    return { implemented: false, plan: cloudPlan, architecture: { ...EMPTY_ARCHITECTURE, statusReasons: ["no discovery result available"] }, artifacts: [], notes };
  }

  const workflowOutput = siblingOutput<WorkflowAutomationSection>(context, "workflow-automation");
  const integrationsOutput = siblingOutput<IntegrationsSection>(context, "integrations");
  const agentsOutput = siblingOutput<AIAgentsSection>(context, "ai-agents");
  const securityOutput = siblingOutput<SecurityGovernanceOutput>(context, "security-governance");
  const observabilityOutput = siblingOutput<ObservabilitySection>(context, "observability");

  const workflows = workflowOutput?.workflows ?? [];
  const integrations = integrationsOutput?.integrations ?? [];
  const agents = agentsOutput?.agents ?? [];
  const security = securityOutput?.security ?? emptySecurityArchitecture();
  const governance = securityOutput?.governance ?? emptyGovernancePlan();
  const observability = observabilityOutput?.architecture ?? EMPTY_OBSERVABILITY_ARCHITECTURE;

  if (workflows.length > 0) notes.push(`Analyzed ${workflows.length} Workflow Automation workflow(s).`);
  if (integrations.length > 0) notes.push(`Analyzed ${integrations.length} Integration(s).`);
  if (agents.length > 0) notes.push(`Analyzed ${agents.length} AI Agent architecture specification(s).`);
  if (security.requirements.length > 0) notes.push(`Analyzed Security & Governance architecture (${security.requirements.length} requirement(s)).`);
  if (observability.signals.length > 0) notes.push(`Analyzed Observability architecture (${observability.signals.length} signal(s)).`);

  const architecture = buildCloudArchitecture(discovery, workflows, integrations, agents, security, governance, observability);

  const validation = validateCloudArchitecture(architecture, discovery, workflows, integrations, agents, security, observability);
  if (!validation.ok) {
    notes.push(
      `Validation failed: ${validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ")}`
    );
    return { implemented: false, plan: cloudPlan, architecture, artifacts: [], notes };
  }

  const hasAnyArchitecture = architecture.deploymentUnits.length > 0 || architecture.runtimeRequirements.length > 0;
  const artifacts = hasAnyArchitecture ? buildCloudArtifacts(architecture) : [];

  notes.push(
    hasAnyArchitecture
      ? "Generated and validated a vendor-neutral cloud/deployment architecture. This means Stitchfy can produce and validate the specification — not that infrastructure was provisioned, an application was deployed, or the architecture is production-ready."
      : "No cloud/deployment architecture could be derived for this business context."
  );

  return { implemented: hasAnyArchitecture, plan: cloudPlan, architecture, artifacts, notes };
}

function emptySecurityArchitecture(): SecurityGovernanceOutput["security"] {
  return {
    version: "1.0",
    requirements: [],
    trustBoundaries: [],
    dataProtection: [],
    identityAccess: [],
    integrationSecurity: [],
    auditRequirements: [],
    risks: [],
    informationGaps: [],
    evidenceRefs: [],
    status: "draft",
    statusReasons: [],
  };
}

function emptyGovernancePlan(): SecurityGovernanceOutput["governance"] {
  return { policies: [], humanOversight: [], auditRequirements: [], decisionControls: [], complianceConsiderations: [], informationGaps: [], status: "draft" };
}

async function validate(output: CloudArchitectureSection): Promise<ValidationResult<CloudArchitectureSection>> {
  if (output.implemented && output.architecture.deploymentUnits.length === 0 && output.architecture.runtimeRequirements.length === 0) {
    return validationFail(["implemented is true but no cloud architecture was produced"]);
  }
  return validationOk(output);
}

export const cloudCapability: StitchfyCapability<CapabilityAssessment, CloudArchitectureSection> = {
  id: CLOUD_CAPABILITY_ID,
  name: "Cloud Architecture",
  version: "0.2.0",
  supports,
  assess,
  plan,
  execute,
  validate,
};
