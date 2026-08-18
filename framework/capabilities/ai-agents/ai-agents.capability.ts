/**
 * AI Agents capability — placeholder. See docs/architecture/ROADMAP.md
 * Phase 5 for real agent-definition generation (tools, memory, guardrails,
 * human-approval wiring against framework/governance/approvals).
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { ValidationResult } from "../../schemas/common/validation-result.js";
import { validationOk } from "../../schemas/common/validation-result.js";
import { matchesKeywords } from "../../planning/capability-selector/capability-selector.js";
import type { AIAgentsSection } from "./schemas/ai-agents.types.js";

const CAPABILITY_ID = "ai-agents";
const KEYWORDS = ["ai agent", "chatbot", "assistant", "copilot", "virtual agent", "automate responses"];

interface PlanInput {
  matchedOn: string;
}

function supports(context: SolutionContext): boolean {
  const text = [...(context.businessContext?.goals ?? []), ...(context.businessContext?.desiredOutcomes ?? [])].join(
    " "
  );
  return matchesKeywords(text, KEYWORDS);
}

async function plan(_context: SolutionContext): Promise<PlanInput> {
  return { matchedOn: KEYWORDS.join(", ") };
}

async function execute(input: PlanInput, _context: SolutionContext): Promise<AIAgentsSection> {
  return {
    implemented: false,
    agents: [],
    notes: [
      `Capability selected (matched keywords: ${input.matchedOn}) but not yet implemented — see docs/architecture/ROADMAP.md Phase 5.`,
    ],
  };
}

async function validate(output: AIAgentsSection): Promise<ValidationResult<AIAgentsSection>> {
  return validationOk(output);
}

export const aiAgentsCapability: StitchfyCapability<PlanInput, AIAgentsSection> = {
  id: CAPABILITY_ID,
  name: "AI Agents",
  version: "0.1.0",
  supports,
  plan,
  execute,
  validate,
};
