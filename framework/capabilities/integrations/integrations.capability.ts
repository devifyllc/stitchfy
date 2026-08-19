/**
 * Integrations capability — migrated off legacy keyword matching (Phase 4).
 * supports()/assess() delegate to the same assessIntegrations() — one
 * source of truth for selection. execute() reads Workflow Automation's
 * sibling output (if it already ran — registry order is unchanged,
 * workflow-automation is registered before integrations) purely to enrich
 * generation with WorkflowDefinition evidence; the selection decision
 * itself never depends on it. `implemented: true` means Stitchfy generated
 * and validated one or more vendor-neutral integration specifications —
 * never that it connected to or exchanged data with an external system.
 *
 * `exports` always starts empty here (Phase 5.5A) — export-bundle
 * generation needs SecurityArchitecture, which doesn't exist yet at this
 * capability's own execution time (security-governance registers after
 * integrations). It's populated by a post-loop step in
 * solution-orchestrator.ts instead — see
 * framework/capabilities/integrations/exporters/generate-integration-exports.ts.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessIntegrations, INTEGRATIONS_CAPABILITY_ID } from "./integrations.assessor.js";
import { buildIntegrationPlan } from "./integrations.planner.js";
import { buildIntegrationDefinitions } from "./generators/integration-definition.generator.js";
import { buildIntegrationArtifacts } from "./generators/integration-artifact.generator.js";
import { validateIntegrationDefinition, detectDuplicateIntegrations } from "./validators/integration-definition.validator.js";
import type { IntegrationsSection, IntegrationDefinition } from "./schemas/integrations.types.js";
import type { ImplementationArtifact } from "../../core/contracts/artifact.js";
import type { WorkflowAutomationSection } from "../workflow-automation/schemas/workflow-automation.types.js";

function supports(context: SolutionContext): boolean {
  const assessment = assessIntegrations(context);
  return assessment.status === "recommended" || assessment.status === "needs-review";
}

function assess(context: SolutionContext): CapabilityAssessment {
  return assessIntegrations(context);
}

async function plan(context: SolutionContext): Promise<CapabilityAssessment> {
  return assessIntegrations(context);
}

async function execute(
  assessment: CapabilityAssessment,
  context: SolutionContext
): Promise<IntegrationsSection> {
  const integrationPlan = buildIntegrationPlan(context, assessment);
  const discovery = context.discoveryResult;

  const notes: string[] = [
    `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
    ...assessment.reasons.map((r) => r.description),
  ];

  if (!discovery || integrationPlan.candidates.length === 0) {
    notes.push("No cross-system boundary identified to specify an integration for.");
    return { implemented: false, plan: integrationPlan, integrations: [], exports: [], artifacts: [], notes };
  }

  const workflowResult = context.capabilityResults.find((r) => r.capabilityId === "workflow-automation");
  const workflowOutput = workflowResult?.output as WorkflowAutomationSection | undefined;
  const workflows = workflowOutput?.workflows ?? [];
  if (workflows.length > 0) {
    notes.push(`Enriched with evidence from ${workflows.length} Workflow Automation workflow(s).`);
  }

  const candidates = buildIntegrationDefinitions(discovery, integrationPlan.candidates, workflows);

  const duplicateIssues = detectDuplicateIntegrations(candidates);
  const duplicateIds = new Set(
    duplicateIssues.map((issue) => issue.message.match(/^integration "([^"]+)"/)?.[1]).filter((id): id is string => Boolean(id))
  );

  const integrations: IntegrationDefinition[] = [];
  const artifacts: ImplementationArtifact[] = [];
  const workflowIds = workflows.map((w) => w.id);

  for (const integration of candidates) {
    if (duplicateIds.has(integration.id)) {
      notes.push(`Integration "${integration.name}" skipped: duplicate of an earlier definition.`);
      continue;
    }
    const validation = validateIntegrationDefinition(integration, discovery, workflowIds);
    if (!validation.ok) {
      notes.push(
        `Integration "${integration.name}" failed validation: ${validation.issues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("; ")}`
      );
      continue;
    }
    integrations.push(integration);
    artifacts.push(...buildIntegrationArtifacts(integration, discovery));
  }

  notes.push(
    integrations.length > 0
      ? `Generated and validated ${integrations.length} vendor-neutral integration specification(s). This means Stitchfy can produce and validate the spec — not that it has connected to or exchanged data with any external system.`
      : "No integration specification could be validated for this business context."
  );

  return { implemented: integrations.length > 0, plan: integrationPlan, integrations, exports: [], artifacts, notes };
}

async function validate(
  output: IntegrationsSection
): Promise<ValidationResult<IntegrationsSection>> {
  if (output.implemented && output.integrations.length === 0) {
    return validationFail(["implemented is true but no integrations were produced"]);
  }
  return validationOk(output);
}

export const integrationsCapability: StitchfyCapability<CapabilityAssessment, IntegrationsSection> = {
  id: INTEGRATIONS_CAPABILITY_ID,
  name: "Integrations",
  version: "0.3.0",
  supports,
  assess,
  plan,
  execute,
  validate,
};
