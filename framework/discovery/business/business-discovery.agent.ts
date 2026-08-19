/**
 * Business Discovery Agent — composes the per-concept extractors into a
 * full DiscoveryResult (see ../discovery-result.types.ts for why
 * DiscoveryResult, not BusinessContext, is the source of truth as of
 * Phase 1).
 *
 * businessName/industry extraction still reuses the existing `getSection`
 * alias lookup (framework/core/markdown-parser.ts) for the "business"
 * section, same as intake.agent.ts. Every other extractor uses the
 * discovery-local `SECTION_CANDIDATES` table (shared/section-lookup.ts)
 * since those headings aren't in the website-oriented SECTION_ALIASES.
 *
 * ID generators for actors/systems/pain points/business rules are created
 * once here and threaded through both the top-level extractors and
 * extractProcesses(), so an entity mentioned inside a process either
 * resolves to an existing id or continues the same numbering sequence
 * rather than colliding with it.
 *
 * Local mode: deterministic extraction throughout. OpenAI mode (future):
 * same OPENAI INTEGRATION POINT pattern as the website agents — see
 * framework/agents/intake.agent.ts. Any LLM-produced field would need to be
 * validated against framework/schemas/discovery/discovery-result.schema.ts
 * and marked `metadata.inferred: true`, never merged in as if explicit.
 */

import type { Agent } from "../../core/contracts/agent.js";
import type { ParsedProject } from "../../core/markdown-parser.js";
import { getSection } from "../../core/markdown-parser.js";
import { makeIdGenerator } from "../shared/section-lookup.js";
import type { DiscoveryResult } from "../discovery-result.types.js";

import { extractGoals, extractPainPoints, extractDesiredOutcomes } from "./goals-outcomes.extractor.js";
import { extractActors } from "../actors/actors.extractor.js";
import { extractSystems } from "../systems/systems.extractor.js";
import { extractConstraints } from "../constraints/constraints.extractor.js";
import { extractDataEntities } from "../data/data-entities.extractor.js";
import { extractIntegrationNeeds } from "../integrations/integration-needs.extractor.js";
import { extractBusinessRules } from "../business-rules/business-rules.extractor.js";
import { extractProcesses } from "../processes/processes.extractor.js";
import { extractRequirements } from "../requirements/requirements.extractor.js";
import { extractInformationGaps } from "../gaps/information-gaps.extractor.js";
import { extractTraceabilityLinks } from "../traceability/traceability.extractor.js";
import { extractAIAgentNeeds } from "../ai-agents/ai-agent-needs.extractor.js";

export interface BusinessDiscoveryInput {
  parsed: ParsedProject;
}

function extractBusinessNameAndIndustry(parsed: ParsedProject): { businessName: string; industry: string } {
  const bizSection = getSection(parsed, "business");
  const businessName =
    bizSection?.keyValues["Business Name"] ??
    bizSection?.keyValues["Name"] ??
    parsed.title.replace(/^Project:\s*/i, "").trim();
  const industry = bizSection?.keyValues["Industry"] ?? bizSection?.keyValues["Type"] ?? "";
  return { businessName, industry };
}

async function run(input: BusinessDiscoveryInput): Promise<DiscoveryResult> {
  const { parsed } = input;
  const { businessName, industry } = extractBusinessNameAndIndustry(parsed);

  const goals = extractGoals(parsed);
  const desiredOutcomes = extractDesiredOutcomes(parsed);
  const constraints = extractConstraints(parsed);
  const dataEntities = extractDataEntities(parsed);

  const actorIdGen = makeIdGenerator("ACTOR");
  const systemIdGen = makeIdGenerator("SYS");
  const painPointIdGen = makeIdGenerator("PP");
  const businessRuleIdGen = makeIdGenerator("BR");
  const processIdGen = makeIdGenerator("PROC");

  const actors = extractActors(parsed, actorIdGen);
  const systems = extractSystems(parsed, systemIdGen);
  const painPoints = extractPainPoints(parsed, painPointIdGen);
  const businessRules = extractBusinessRules(parsed, businessRuleIdGen);
  const integrationNeeds = extractIntegrationNeeds(parsed, systems);

  const processResult = extractProcesses(parsed, actors, systems, painPoints, {
    process: processIdGen,
    actor: actorIdGen,
    system: systemIdGen,
    painPoint: painPointIdGen,
    rule: businessRuleIdGen,
  });

  const allActors = [...actors, ...processResult.additionalActors];
  const allSystems = [...systems, ...processResult.additionalSystems];
  const allPainPoints = [...painPoints, ...processResult.additionalPainPoints];
  const allBusinessRules = [...businessRules, ...processResult.additionalBusinessRules];

  const requirements = extractRequirements(parsed, desiredOutcomes);
  const aiAgentNeeds = extractAIAgentNeeds(parsed, allActors);

  const withoutGapsAndTraceability = {
    businessName,
    industry,
    goals,
    painPoints: allPainPoints,
    desiredOutcomes,
    actors: allActors,
    processes: processResult.processes,
    requirements,
    systems: allSystems,
    integrationNeeds,
    dataEntities,
    constraints,
    businessRules: allBusinessRules,
    aiAgentNeeds,
  };

  const informationGaps = extractInformationGaps(withoutGapsAndTraceability);
  const traceability = extractTraceabilityLinks(requirements, processResult.processes);

  return { ...withoutGapsAndTraceability, informationGaps, traceability };
}

export const businessDiscoveryAgent: Agent<BusinessDiscoveryInput, DiscoveryResult> = {
  name: "BusinessDiscoveryAgent",
  run,
};
