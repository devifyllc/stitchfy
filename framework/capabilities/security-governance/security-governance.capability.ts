/**
 * Security & Governance capability — migrated off legacy keyword matching
 * (Phase 5). supports()/assess() delegate to the same
 * assessSecurityGovernance() — one source of truth for selection.
 * execute() reads both Workflow Automation's and Integrations' sibling
 * output (registry order is unchanged — both already run before this
 * capability) to build an evidence-backed SecurityArchitecture/
 * GovernancePlan. `implemented: true` means Stitchfy generated and
 * validated a security/governance architecture for the currently known
 * solution — never that the resulting system is secure, compliant,
 * certified, or production-ready.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessSecurityGovernance, SECURITY_GOVERNANCE_CAPABILITY_ID } from "./security-governance.assessor.js";
import { buildSecurityArchitecture } from "./generators/security-architecture.generator.js";
import { buildGovernancePlan } from "./generators/governance-plan.generator.js";
import { buildAIAgentSecurityRequirements } from "./generators/ai-agent-security.generator.js";
import { buildAIAgentGovernanceControls } from "./generators/ai-agent-governance.generator.js";
import { buildSecurityGovernanceArtifacts } from "./generators/security-artifact.generator.js";
import { validateSecurityArchitecture, validateGovernancePlan } from "./validators/security-architecture.validator.js";
import type { SecurityGovernanceOutput } from "./schemas/security-governance.types.js";
import type { WorkflowAutomationSection, WorkflowDefinition } from "../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationsSection, IntegrationDefinition } from "../integrations/schemas/integrations.types.js";
import type { AIAgentsSection, AIAgentDefinition } from "../ai-agents/schemas/ai-agents.types.js";

function supports(context: SolutionContext): boolean {
  const assessment = assessSecurityGovernance(context);
  return assessment.status === "recommended" || assessment.status === "needs-review";
}

function assess(context: SolutionContext): CapabilityAssessment {
  return assessSecurityGovernance(context);
}

async function plan(context: SolutionContext): Promise<CapabilityAssessment> {
  return assessSecurityGovernance(context);
}

function siblingOutput<T>(context: SolutionContext, capabilityId: string): T | undefined {
  return context.capabilityResults.find((r) => r.capabilityId === capabilityId)?.output as T | undefined;
}

async function execute(
  assessment: CapabilityAssessment,
  context: SolutionContext
): Promise<SecurityGovernanceOutput> {
  const discovery = context.discoveryResult;

  const notes: string[] = [
    `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
    ...assessment.reasons.map((r) => r.description),
  ];

  const emptyOutput = (security: SecurityGovernanceOutput["security"], governance: SecurityGovernanceOutput["governance"]): SecurityGovernanceOutput => ({
    implemented: false,
    security,
    governance,
    artifacts: [],
    notes,
  });

  if (!discovery) {
    notes.push("No discovery result available to analyze.");
    return emptyOutput(
      {
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
        statusReasons: ["no discovery result available"],
      },
      { policies: [], humanOversight: [], auditRequirements: [], decisionControls: [], complianceConsiderations: [], informationGaps: [], status: "draft" }
    );
  }

  const workflowOutput = siblingOutput<WorkflowAutomationSection>(context, "workflow-automation");
  const integrationsOutput = siblingOutput<IntegrationsSection>(context, "integrations");
  const agentsOutput = siblingOutput<AIAgentsSection>(context, "ai-agents");
  const workflows: WorkflowDefinition[] = workflowOutput?.workflows ?? [];
  const integrations: IntegrationDefinition[] = integrationsOutput?.integrations ?? [];
  const agents: AIAgentDefinition[] = agentsOutput?.agents ?? [];

  if (workflows.length > 0) notes.push(`Analyzed ${workflows.length} Workflow Automation workflow(s).`);
  if (integrations.length > 0) notes.push(`Analyzed ${integrations.length} Integration(s).`);
  if (agents.length > 0) notes.push(`Analyzed ${agents.length} AI Agent architecture specification(s).`);

  const security = buildSecurityArchitecture(discovery, workflows, integrations);
  const governance = buildGovernancePlan(discovery, workflows, security);

  // AI agent architecture is consumed, never regenerated (task item 31) —
  // security-governance now registers after ai-agents, so AIAgentDefinition[]
  // is already available here, the same sibling-read pattern already used
  // for workflow-automation/integrations above.
  if (agents.length > 0) {
    const agentSecurity = buildAIAgentSecurityRequirements(agents);
    security.requirements.push(...agentSecurity.requirements);
    security.risks.push(...agentSecurity.risks);
    security.informationGaps.push(...agentSecurity.informationGaps);
    if (
      (agentSecurity.requirements.some((r) => r.status === "needs-information") || agentSecurity.informationGaps.length > 0) &&
      security.status === "complete"
    ) {
      security.status = "needs-review";
      security.statusReasons.push("AI agent architecture introduces additional unresolved security considerations");
    }

    governance.aiAgentControls = buildAIAgentGovernanceControls(agents);
  }

  const securityValidation = validateSecurityArchitecture(security, discovery, workflows, integrations, agents);
  const governanceValidation = validateGovernancePlan(governance, workflows);

  if (!securityValidation.ok || !governanceValidation.ok) {
    notes.push(
      `Validation failed: ${[...securityValidation.issues, ...governanceValidation.issues]
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ")}`
    );
    return emptyOutput(security, governance);
  }

  const artifacts = buildSecurityGovernanceArtifacts(security, governance, discovery, workflows);

  notes.push(
    "Generated and validated a vendor-neutral security/governance architecture. This means Stitchfy can produce and " +
      "validate the specification — not that the system is secure, compliant, certified, or production-ready."
  );

  return { implemented: true, security, governance, artifacts, notes };
}

async function validate(
  output: SecurityGovernanceOutput
): Promise<ValidationResult<SecurityGovernanceOutput>> {
  if (output.implemented && output.artifacts.length === 0) {
    return validationFail(["implemented is true but no artifacts were produced"]);
  }
  return validationOk(output);
}

export const securityGovernanceCapability: StitchfyCapability<CapabilityAssessment, SecurityGovernanceOutput> = {
  id: SECURITY_GOVERNANCE_CAPABILITY_ID,
  name: "Security & Governance",
  version: "0.2.0",
  supports,
  assess,
  plan,
  execute,
  validate,
};
