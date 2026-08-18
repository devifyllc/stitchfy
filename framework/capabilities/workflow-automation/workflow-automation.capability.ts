/**
 * Workflow Automation capability — placeholder.
 *
 * supports() uses the same keyword-heuristic pattern as the website
 * pipeline's industry defaults (see capability-selector.ts). execute() is
 * intentionally not implemented yet — see docs/architecture/ROADMAP.md
 * Phase 3.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import { matchesKeywords } from "../../planning/capability-selector/capability-selector.js";
import type { WorkflowAutomationSection } from "./schemas/workflow-automation.types.js";

const CAPABILITY_ID = "workflow-automation";
const KEYWORDS = ["workflow", "approval process", "automat", "manual process", "hand-off", "handoff"];

interface PlanInput {
  matchedOn: string;
}

function supports(context: SolutionContext): boolean {
  const text = [
    ...(context.businessContext?.goals ?? []),
    ...(context.businessContext?.processes ?? []),
    ...(context.businessContext?.painPoints ?? []),
  ].join(" ");
  return matchesKeywords(text, KEYWORDS);
}

async function plan(_context: SolutionContext): Promise<PlanInput> {
  return { matchedOn: KEYWORDS.join(", ") };
}

async function execute(input: PlanInput, _context: SolutionContext): Promise<WorkflowAutomationSection> {
  return {
    implemented: false,
    triggers: [],
    steps: [],
    decisions: [],
    approvals: [],
    notifications: [],
    externalSystems: [],
    notes: [
      `Capability selected (matched keywords: ${input.matchedOn}) but not yet implemented — see docs/architecture/ROADMAP.md Phase 3.`,
    ],
  };
}

async function validate(
  output: WorkflowAutomationSection
): Promise<ValidationResult<WorkflowAutomationSection>> {
  return validationOk(output);
}

export const workflowAutomationCapability: StitchfyCapability<PlanInput, WorkflowAutomationSection> = {
  id: CAPABILITY_ID,
  name: "Workflow Automation",
  version: "0.1.0",
  supports,
  plan,
  execute,
  validate,
};
