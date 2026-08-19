/**
 * Workflow Automation capability — the first to use structured assessment
 * (Phase 1.5) instead of keyword matching. supports() and assess() both
 * delegate to the same assessWorkflowAutomation() — one source of truth for
 * the selection rule (see docs/architecture/ARCHITECTURE.md). plan()/
 * execute() are now meaningful (task item 8): plan() is the assessment
 * itself, execute() turns it into a real WorkflowAutomationPlan via
 * workflow-automation.planner.ts. `implemented` stays false — only
 * selection and planning became real in this phase, not execution.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import { assessWorkflowAutomation, WORKFLOW_AUTOMATION_CAPABILITY_ID } from "./workflow-automation.assessor.js";
import { buildWorkflowAutomationPlan } from "./workflow-automation.planner.js";
import type { WorkflowAutomationSection } from "./schemas/workflow-automation.types.js";

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

  return {
    implemented: false,
    plan,
    triggers: [],
    steps: [],
    decisions: [],
    approvals: [],
    notifications: [],
    externalSystems: [],
    notes: [
      `Status: ${assessment.status} (confidence: ${assessment.confidence}, method: ${assessment.method}).`,
      ...assessment.reasons.map((r) => r.description),
      "Selection and planning are real; execution (implemented: false) is deferred — see docs/architecture/ROADMAP.md Phase 3.",
    ],
  };
}

async function validate(
  output: WorkflowAutomationSection
): Promise<ValidationResult<WorkflowAutomationSection>> {
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
