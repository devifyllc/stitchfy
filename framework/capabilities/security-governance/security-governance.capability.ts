/**
 * Security & Governance capability — placeholder. Produces both the
 * `security` and `governance` SolutionBlueprint sections from one capability
 * module (see schemas/security-governance.types.ts). See
 * docs/architecture/ROADMAP.md Phase 6.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import { matchesKeywords } from "../../planning/capability-selector/capability-selector.js";
import type { SecurityGovernanceOutput } from "./schemas/security-governance.types.js";

const CAPABILITY_ID = "security-governance";
const KEYWORDS = [
  "secure",
  "security",
  "compliance",
  "pii",
  "gdpr",
  "hipaa",
  "authentication",
  "login",
  "audit",
];

interface PlanInput {
  matchedOn: string;
}

function supports(context: SolutionContext): boolean {
  const text = [
    ...(context.businessContext?.businessRules ?? []),
    ...(context.businessContext?.constraints ?? []),
    ...(context.businessContext?.data ?? []),
  ].join(" ");
  return matchesKeywords(text, KEYWORDS);
}

async function plan(_context: SolutionContext): Promise<PlanInput> {
  return { matchedOn: KEYWORDS.join(", ") };
}

async function execute(input: PlanInput, _context: SolutionContext): Promise<SecurityGovernanceOutput> {
  const note = `Capability selected (matched keywords: ${input.matchedOn}) but not yet implemented — see docs/architecture/ROADMAP.md Phase 6.`;
  return {
    security: {
      implemented: false,
      authentication: [],
      authorization: [],
      secretsManagement: [],
      encryption: [],
      piiHandling: [],
      dataClassification: [],
      notes: [note],
    },
    governance: {
      implemented: false,
      auditability: [],
      responsibleAI: [],
      humanOversight: [],
      policies: [],
      notes: [note],
    },
  };
}

async function validate(
  output: SecurityGovernanceOutput
): Promise<ValidationResult<SecurityGovernanceOutput>> {
  return validationOk(output);
}

export const securityGovernanceCapability: StitchfyCapability<PlanInput, SecurityGovernanceOutput> = {
  id: CAPABILITY_ID,
  name: "Security & Governance",
  version: "0.1.0",
  supports,
  plan,
  execute,
  validate,
};
