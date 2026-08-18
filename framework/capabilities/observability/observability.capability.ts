/**
 * Observability capability — placeholder. See docs/architecture/ROADMAP.md
 * Phase 7.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import { matchesKeywords } from "../../planning/capability-selector/capability-selector.js";
import type { ObservabilitySection } from "./schemas/observability.types.js";

const CAPABILITY_ID = "observability";
const KEYWORDS = ["monitor", "logging", "alert", "dashboard", "uptime", "trace", "metrics"];

interface PlanInput {
  matchedOn: string;
}

function supports(context: SolutionContext): boolean {
  const text = [
    ...(context.businessContext?.constraints ?? []),
    ...(context.businessContext?.existingSystems ?? []),
  ].join(" ");
  return matchesKeywords(text, KEYWORDS);
}

async function plan(_context: SolutionContext): Promise<PlanInput> {
  return { matchedOn: KEYWORDS.join(", ") };
}

async function execute(input: PlanInput, _context: SolutionContext): Promise<ObservabilitySection> {
  return {
    implemented: false,
    logging: [],
    metrics: [],
    tracing: [],
    alerting: [],
    dashboards: [],
    auditEvents: [],
    notes: [
      `Capability selected (matched keywords: ${input.matchedOn}) but not yet implemented — see docs/architecture/ROADMAP.md Phase 7.`,
    ],
  };
}

async function validate(output: ObservabilitySection): Promise<ValidationResult<ObservabilitySection>> {
  return validationOk(output);
}

export const observabilityCapability: StitchfyCapability<PlanInput, ObservabilitySection> = {
  id: CAPABILITY_ID,
  name: "Observability",
  version: "0.1.0",
  supports,
  plan,
  execute,
  validate,
};
