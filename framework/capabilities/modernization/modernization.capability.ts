/**
 * Legacy Modernization capability — placeholder. See
 * docs/architecture/ROADMAP.md Phase 8.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import { matchesKeywords } from "../../planning/capability-selector/capability-selector.js";
import type { ModernizationSection } from "./schemas/modernization.types.js";

const CAPABILITY_ID = "modernization";
const KEYWORDS = ["legacy", "migrate", "migration", "modernize", "modernise", "end of life", "outdated system"];

interface PlanInput {
  matchedOn: string;
}

function supports(context: SolutionContext): boolean {
  const text = [
    ...(context.businessContext?.existingSystems ?? []),
    ...(context.businessContext?.painPoints ?? []),
  ].join(" ");
  return matchesKeywords(text, KEYWORDS);
}

async function plan(_context: SolutionContext): Promise<PlanInput> {
  return { matchedOn: KEYWORDS.join(", ") };
}

async function execute(input: PlanInput, _context: SolutionContext): Promise<ModernizationSection> {
  return {
    implemented: false,
    systemInventory: [],
    dependencies: [],
    applications: [],
    integrations: [],
    technicalDebt: [],
    migrationCandidates: [],
    migrationStrategies: [],
    recommendations: [],
    notes: [
      `Capability selected (matched keywords: ${input.matchedOn}) but not yet implemented — see docs/architecture/ROADMAP.md Phase 8.`,
    ],
  };
}

async function validate(output: ModernizationSection): Promise<ValidationResult<ModernizationSection>> {
  return validationOk(output);
}

export const modernizationCapability: StitchfyCapability<PlanInput, ModernizationSection> = {
  id: CAPABILITY_ID,
  name: "Legacy Modernization",
  version: "0.1.0",
  supports,
  plan,
  execute,
  validate,
};
