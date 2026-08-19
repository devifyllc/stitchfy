/**
 * Legacy Modernization capability — migrated off the Phase 0 keyword list
 * (legacy/migrate/migration/modernize/modernise/end of life/outdated
 * system) and its unstructured string[]-array skeleton (Phase 8).
 * supports()/assess() delegate to assessModernization(). execute() reads
 * Integrations', Security & Governance's, Observability's, and Cloud's
 * sibling output (registry order already places all four before
 * modernization, which runs last) to build an evidence-backed
 * ModernizationArchitecture. `implemented: true` means Stitchfy generated
 * and validated a legacy-modernization assessment and migration-strategy
 * architecture from currently known evidence — never that application code
 * was analyzed, migrated, or that a target system was deployed.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessModernization, MODERNIZATION_CAPABILITY_ID } from "./modernization.assessor.js";
import { buildModernizationPlan } from "./modernization.planner.js";
import { buildModernizationArchitecture } from "./generators/modernization-architecture.generator.js";
import { buildModernizationArtifacts } from "./generators/modernization-artifact.generator.js";
import { validateModernizationArchitecture } from "./validators/modernization.validator.js";
import type { ModernizationSection, ModernizationArchitecture } from "./schemas/modernization.types.js";
import type { IntegrationsSection } from "../integrations/schemas/integrations.types.js";
import type { SecurityGovernanceOutput } from "../security-governance/schemas/security-governance.types.js";
import type { ObservabilitySection, ObservabilityArchitecture } from "../observability/schemas/observability.types.js";
import type { CloudArchitectureSection } from "../cloud/schemas/cloud.types.js";

function supports(context: SolutionContext): boolean {
  const assessment = assessModernization(context);
  return assessment.status === "recommended" || assessment.status === "needs-review";
}

function assess(context: SolutionContext): CapabilityAssessment {
  return assessModernization(context);
}

async function plan(context: SolutionContext): Promise<CapabilityAssessment> {
  return assessModernization(context);
}

function siblingOutput<T>(context: SolutionContext, capabilityId: string): T | undefined {
  return context.capabilityResults.find((r) => r.capabilityId === capabilityId)?.output as T | undefined;
}

const EMPTY_ARCHITECTURE: ModernizationArchitecture = {
  version: "1.0",
  profiles: [],
  dependencies: [],
  technicalDebt: [],
  preservationRequirements: [],
  seams: [],
  migrationConstraints: [],
  migrationCandidates: [],
  modernizationDeltas: [],
  targetStateRequirements: [],
  validationRequirements: [],
  risks: [],
  roadmap: { candidateIds: [], workstreams: [], dependencies: [], validationRequirementIds: [], informationGapIds: [], status: "draft" },
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

async function execute(assessment: CapabilityAssessment, context: SolutionContext): Promise<ModernizationSection> {
  const modernizationPlan = buildModernizationPlan(context, assessment);
  const discovery = context.discoveryResult;

  const notes: string[] = [
    `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
    ...assessment.reasons.map((r) => r.description),
  ];

  if (!discovery) {
    notes.push("No discovery result available to analyze.");
    return { implemented: false, plan: modernizationPlan, architecture: { ...EMPTY_ARCHITECTURE, statusReasons: ["no discovery result available"] }, artifacts: [], notes };
  }

  const integrationsOutput = siblingOutput<IntegrationsSection>(context, "integrations");
  const securityOutput = siblingOutput<SecurityGovernanceOutput>(context, "security-governance");
  const observabilityOutput = siblingOutput<ObservabilitySection>(context, "observability");
  const cloudOutput = siblingOutput<CloudArchitectureSection>(context, "cloud");

  const integrations = integrationsOutput?.integrations ?? [];
  const security = securityOutput?.security ?? emptySecurityArchitecture();
  const observability = observabilityOutput?.architecture ?? EMPTY_OBSERVABILITY_ARCHITECTURE;
  const cloud = cloudOutput?.architecture;

  if (integrations.length > 0) notes.push(`Analyzed ${integrations.length} Integration(s).`);
  if (security.requirements.length > 0) notes.push(`Analyzed Security & Governance architecture (${security.requirements.length} requirement(s)).`);
  if (observability.signals.length > 0) notes.push(`Analyzed Observability architecture (${observability.signals.length} signal(s)).`);
  if (cloud && cloud.deploymentUnits.length > 0) notes.push(`Analyzed Cloud architecture (${cloud.deploymentUnits.length} deployment unit(s)).`);

  const architecture = buildModernizationArchitecture(discovery, integrations, security, observability, cloud);

  const validation = validateModernizationArchitecture(architecture, discovery, integrations);
  if (!validation.ok) {
    notes.push(
      `Validation failed: ${validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join("; ")}`
    );
    return { implemented: false, plan: modernizationPlan, architecture, artifacts: [], notes };
  }

  const hasAnyArchitecture = architecture.profiles.length > 0;
  const artifacts = hasAnyArchitecture ? buildModernizationArtifacts(architecture) : [];

  notes.push(
    hasAnyArchitecture
      ? "Generated and validated a legacy-modernization assessment and migration-strategy architecture. This means Stitchfy can produce and validate the specification — not that application code was analyzed, migrated, or that a target system was deployed."
      : "No modernization architecture could be derived for this business context."
  );

  return { implemented: hasAnyArchitecture, plan: modernizationPlan, architecture, artifacts, notes };
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

async function validate(output: ModernizationSection): Promise<ValidationResult<ModernizationSection>> {
  if (output.implemented && output.architecture.profiles.length === 0) {
    return validationFail(["implemented is true but no modernization architecture was produced"]);
  }
  return validationOk(output);
}

export const modernizationCapability: StitchfyCapability<CapabilityAssessment, ModernizationSection> = {
  id: MODERNIZATION_CAPABILITY_ID,
  name: "Legacy Modernization",
  version: "0.2.0",
  supports,
  assess,
  plan,
  execute,
  validate,
};
