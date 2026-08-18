/**
 * Integrations capability — placeholder. See docs/architecture/ROADMAP.md
 * Phase 4.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import { matchesKeywords } from "../../planning/capability-selector/capability-selector.js";
import type { IntegrationsSection } from "./schemas/integrations.types.js";

const CAPABILITY_ID = "integrations";
const KEYWORDS = ["integrate", "integration", "api", "webhook", "sync with", "connect to", "third-party"];

interface PlanInput {
  matchedOn: string;
}

function supports(context: SolutionContext): boolean {
  const text = [
    ...(context.businessContext?.integrations ?? []),
    ...(context.businessContext?.existingSystems ?? []),
  ].join(" ");
  return matchesKeywords(text, KEYWORDS);
}

async function plan(_context: SolutionContext): Promise<PlanInput> {
  return { matchedOn: KEYWORDS.join(", ") };
}

async function execute(input: PlanInput, _context: SolutionContext): Promise<IntegrationsSection> {
  return {
    implemented: false,
    restApis: [],
    webhooks: [],
    saasIntegrations: [],
    dataMappings: [],
    errorHandling: [],
    notes: [
      `Capability selected (matched keywords: ${input.matchedOn}) but not yet implemented — see docs/architecture/ROADMAP.md Phase 4.`,
    ],
  };
}

async function validate(output: IntegrationsSection): Promise<ValidationResult<IntegrationsSection>> {
  return validationOk(output);
}

export const integrationsCapability: StitchfyCapability<PlanInput, IntegrationsSection> = {
  id: CAPABILITY_ID,
  name: "Integrations",
  version: "0.1.0",
  supports,
  plan,
  execute,
  validate,
};
