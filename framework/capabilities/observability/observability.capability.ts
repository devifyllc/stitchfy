/**
 * Observability capability — migrated off legacy keyword matching
 * (Phase 7A). supports()/assess() delegate to the same
 * assessObservability() — one source of truth for selection. execute()
 * reads Workflow Automation's, Integrations', AI Agents', and Security &
 * Governance's sibling output (registry order already places all four
 * before observability — see docs/architecture/ARCHITECTURE.md
 * "Observability and Operational Architecture") to build an evidence-backed
 * ObservabilityArchitecture. `implemented: true` means Stitchfy generated
 * and validated a vendor-neutral observability and operational architecture
 * for the currently known solution — never that telemetry is collected,
 * dashboards are deployed, alerts are active, or production operations are
 * ready.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessObservability, OBSERVABILITY_CAPABILITY_ID } from "./observability.assessor.js";
import { buildObservabilityPlan } from "./observability.planner.js";
import { buildObservabilityArchitecture } from "./generators/observability-architecture.generator.js";
import { buildObservabilityArtifacts } from "./generators/observability-artifact.generator.js";
import { validateObservabilityArchitecture } from "./validators/observability.validator.js";
import type { ObservabilitySection, ObservabilityArchitecture } from "./schemas/observability.types.js";
import type { WorkflowAutomationSection } from "../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationsSection } from "../integrations/schemas/integrations.types.js";
import type { AIAgentsSection } from "../ai-agents/schemas/ai-agents.types.js";
import type { SecurityGovernanceOutput } from "../security-governance/schemas/security-governance.types.js";

function supports(context: SolutionContext): boolean {
  const assessment = assessObservability(context);
  return assessment.status === "recommended" || assessment.status === "needs-review";
}

function assess(context: SolutionContext): CapabilityAssessment {
  return assessObservability(context);
}

async function plan(context: SolutionContext): Promise<CapabilityAssessment> {
  return assessObservability(context);
}

function siblingOutput<T>(context: SolutionContext, capabilityId: string): T | undefined {
  return context.capabilityResults.find((r) => r.capabilityId === capabilityId)?.output as T | undefined;
}

const EMPTY_ARCHITECTURE: ObservabilityArchitecture = {
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

async function execute(assessment: CapabilityAssessment, context: SolutionContext): Promise<ObservabilitySection> {
  const observabilityPlan = buildObservabilityPlan(context, assessment);
  const discovery = context.discoveryResult;

  const notes: string[] = [
    `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
    ...assessment.reasons.map((r) => r.description),
  ];

  if (!discovery) {
    notes.push("No discovery result available to analyze.");
    return { implemented: false, plan: observabilityPlan, architecture: { ...EMPTY_ARCHITECTURE, statusReasons: ["no discovery result available"] }, artifacts: [], notes };
  }

  const workflowOutput = siblingOutput<WorkflowAutomationSection>(context, "workflow-automation");
  const integrationsOutput = siblingOutput<IntegrationsSection>(context, "integrations");
  const agentsOutput = siblingOutput<AIAgentsSection>(context, "ai-agents");
  const securityOutput = siblingOutput<SecurityGovernanceOutput>(context, "security-governance");

  const workflows = workflowOutput?.workflows ?? [];
  const integrations = integrationsOutput?.integrations ?? [];
  const agents = agentsOutput?.agents ?? [];
  const security = securityOutput?.security ?? { ...emptySecurityArchitecture() };
  const governance = securityOutput?.governance ?? emptyGovernancePlan();

  if (workflows.length > 0) notes.push(`Analyzed ${workflows.length} Workflow Automation workflow(s).`);
  if (integrations.length > 0) notes.push(`Analyzed ${integrations.length} Integration(s).`);
  if (agents.length > 0) notes.push(`Analyzed ${agents.length} AI Agent architecture specification(s).`);
  if (security.requirements.length > 0 || security.auditRequirements.length > 0) {
    notes.push(`Analyzed Security & Governance architecture (${security.auditRequirements.length} audit requirement(s)).`);
  }

  const architecture = buildObservabilityArchitecture(discovery, workflows, integrations, agents, security, governance);

  const validation = validateObservabilityArchitecture(architecture, discovery, workflows, integrations, agents, security);
  if (!validation.ok) {
    notes.push(
      `Validation failed: ${validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ")}`
    );
    return { implemented: false, plan: observabilityPlan, architecture, artifacts: [], notes };
  }

  const hasAnyArchitecture = architecture.signals.length > 0 || architecture.metricRequirements.length > 0 || architecture.healthRequirements.length > 0;
  const artifacts = hasAnyArchitecture ? buildObservabilityArtifacts(architecture) : [];

  notes.push(
    hasAnyArchitecture
      ? "Generated and validated a vendor-neutral observability and operational architecture. This means Stitchfy can produce and validate the specification — not that telemetry is being collected, dashboards are deployed, or production operations are ready."
      : "No operational architecture could be derived for this business context."
  );

  return { implemented: hasAnyArchitecture, plan: observabilityPlan, architecture, artifacts, notes };
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

async function validate(output: ObservabilitySection): Promise<ValidationResult<ObservabilitySection>> {
  if (output.implemented && output.architecture.signals.length === 0 && output.architecture.metricRequirements.length === 0) {
    return validationFail(["implemented is true but no observability architecture was produced"]);
  }
  return validationOk(output);
}

export const observabilityCapability: StitchfyCapability<CapabilityAssessment, ObservabilitySection> = {
  id: OBSERVABILITY_CAPABILITY_ID,
  name: "Observability",
  version: "0.2.0",
  supports,
  assess,
  plan,
  execute,
  validate,
};
