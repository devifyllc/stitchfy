/**
 * Cloud Architecture capability — placeholder. Deliberately not coupled to
 * any vendor: `provider` defaults to "unspecified" until a real
 * framework/providers/cloud/* adapter is selected. See
 * docs/architecture/ROADMAP.md Phase 7.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import { matchesKeywords } from "../../planning/capability-selector/capability-selector.js";
import type { CloudArchitectureSection } from "./schemas/cloud.types.js";

const CAPABILITY_ID = "cloud";
const KEYWORDS = ["cloud", "aws", "azure", "gcp", "scal", "deploy", "infrastructure"];

interface PlanInput {
  matchedOn: string;
}

function supports(context: SolutionContext): boolean {
  const text = [
    ...(context.businessContext?.existingSystems ?? []),
    ...(context.businessContext?.constraints ?? []),
  ].join(" ");
  return matchesKeywords(text, KEYWORDS);
}

async function plan(_context: SolutionContext): Promise<PlanInput> {
  return { matchedOn: KEYWORDS.join(", ") };
}

async function execute(input: PlanInput, _context: SolutionContext): Promise<CloudArchitectureSection> {
  return {
    implemented: false,
    provider: "unspecified",
    compute: [],
    storage: [],
    databases: [],
    networking: { vpcNeeded: false, publicEndpoints: [], notes: [] },
    deploymentStrategy: "",
    scalability: [],
    resilience: [],
    environments: [],
    notes: [
      `Capability selected (matched keywords: ${input.matchedOn}) but not yet implemented — see docs/architecture/ROADMAP.md Phase 7.`,
    ],
  };
}

async function validate(output: CloudArchitectureSection): Promise<ValidationResult<CloudArchitectureSection>> {
  return validationOk(output);
}

export const cloudCapability: StitchfyCapability<PlanInput, CloudArchitectureSection> = {
  id: CAPABILITY_ID,
  name: "Cloud Architecture",
  version: "0.1.0",
  supports,
  plan,
  execute,
  validate,
};
