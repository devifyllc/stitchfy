/**
 * Workflow Automation capability. supports() and assess() delegate to the
 * same assessWorkflowAutomation() — one source of truth for the selection
 * rule (see docs/architecture/ARCHITECTURE.md). Phase 3: execute() turns
 * the WorkflowAutomationPlan into real, validated WorkflowDefinition(s) +
 * ImplementationArtifacts. `implemented: true` means Stitchfy generated and
 * validated a vendor-neutral spec — never that it runs against real
 * systems (task item 22).
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk, validationFail } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessWorkflowAutomation, WORKFLOW_AUTOMATION_CAPABILITY_ID } from "./workflow-automation.assessor.js";
import { buildWorkflowAutomationPlan } from "./workflow-automation.planner.js";
import { buildWorkflowDefinitions } from "./generators/workflow-definition.generator.js";
import { buildWorkflowArtifacts } from "./generators/workflow-artifact.generator.js";
import { validateWorkflowDefinition } from "./validators/workflow-definition.validator.js";
import type { WorkflowAutomationSection, WorkflowDefinition } from "./schemas/workflow-automation.types.js";
import type { ImplementationArtifact } from "../../core/contracts/artifact.js";

function supports(context: SolutionContext): boolean {
  const assessment = assessWorkflowAutomation(context);
  return assessment.status === "recommended" || assessment.status === "needs-review";
}

function assess(context: SolutionContext): CapabilityAssessment {
  return assessWorkflowAutomation(context);
}

async function plan(context: SolutionContext): Promise<CapabilityAssessment> {
  return assessWorkflowAutomation(context);
}

async function execute(
  assessment: CapabilityAssessment,
  context: SolutionContext
): Promise<WorkflowAutomationSection> {
  const plan = buildWorkflowAutomationPlan(context, assessment);
  const discovery = context.discoveryResult;

  const notes: string[] = [
    `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
    ...assessment.reasons.map((r) => r.description),
  ];

  if (!discovery || plan.processIds.length === 0) {
    notes.push("No relevant business process to build a workflow specification from.");
    return { implemented: false, plan, workflows: [], artifacts: [], notes };
  }

  const candidates = buildWorkflowDefinitions(context, plan);
  const workflows: WorkflowDefinition[] = [];
  const artifacts: ImplementationArtifact[] = [];

  for (const workflow of candidates) {
    const validation = validateWorkflowDefinition(workflow, discovery);
    if (!validation.ok) {
      notes.push(
        `Workflow "${workflow.name}" failed validation: ${validation.issues
          .filter((i) => i.severity === "error")
          .map((i) => i.message)
          .join("; ")}`
      );
      continue;
    }
    workflows.push(workflow);
    artifacts.push(...buildWorkflowArtifacts(workflow, discovery));
    if (validation.issues.length > 0) {
      notes.push(`Workflow "${workflow.name}" validated with warnings: ${validation.issues.map((i) => i.message).join("; ")}`);
    }
  }

  notes.push(
    workflows.length > 0
      ? `Generated and validated ${workflows.length} vendor-neutral workflow specification(s). This means Stitchfy can produce and validate the spec — not that it has been deployed or is running against real systems.`
      : "No workflow specification could be validated for this business context."
  );

  return { implemented: workflows.length > 0, plan, workflows, artifacts, notes };
}

async function validate(
  output: WorkflowAutomationSection
): Promise<ValidationResult<WorkflowAutomationSection>> {
  if (output.implemented && output.workflows.length === 0) {
    return validationFail(["implemented is true but no workflows were produced"]);
  }
  return validationOk(output);
}

export const workflowAutomationCapability: StitchfyCapability<CapabilityAssessment, WorkflowAutomationSection> = {
  id: WORKFLOW_AUTOMATION_CAPABILITY_ID,
  name: "Workflow Automation",
  version: "0.2.0",
  supports,
  assess,
  plan,
  execute,
  validate,
};
