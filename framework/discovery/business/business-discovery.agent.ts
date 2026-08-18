/**
 * Business Discovery Agent — extracts BusinessContext from the parsed
 * project Markdown.
 *
 * Reuses the existing `getSection` alias lookup (framework/core/markdown-parser.ts)
 * for the "business" section (name/industry), same as intake.agent.ts. The
 * solution-engineering sections (goals, users, processes, ...) aren't in the
 * website-oriented SECTION_ALIASES table, so this agent does its own heading
 * lookup for those — additive, without touching markdown-parser.ts's existing
 * aliases used by the website pipeline.
 *
 * Local mode: deterministic heading lookup. OpenAI mode (future): same
 * OPENAI INTEGRATION POINT pattern as the website agents — see
 * framework/agents/intake.agent.ts.
 */

import type { Agent } from "../../core/contracts/agent.js";
import type { ParsedProject, ParsedSection } from "../../core/markdown-parser.js";
import { getSection } from "../../core/markdown-parser.js";
import type { BusinessContext } from "./business-context.types.js";

export interface BusinessDiscoveryInput {
  parsed: ParsedProject;
}

function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function findSection(parsed: ParsedProject, candidates: string[]): ParsedSection | undefined {
  for (const heading of candidates) {
    const key = normalizeHeading(heading);
    if (parsed.sections[key]) return parsed.sections[key];
  }
  return undefined;
}

function sectionEntries(section: ParsedSection | undefined): string[] {
  if (!section) return [];
  return [...section.items, ...Object.entries(section.keyValues).map(([k, v]) => `${k}: ${v}`)];
}

const SECTION_CANDIDATES = {
  goals: ["goals", "business goals", "objectives"],
  users: ["users", "target users", "target audience", "customers"],
  processes: ["processes", "business processes", "workflows"],
  painPoints: ["pain points", "challenges", "problems"],
  existingSystems: ["existing systems", "current systems", "systems", "tech stack"],
  businessRules: ["business rules", "rules", "policies"],
  integrations: ["integrations", "third-party integrations", "external systems"],
  data: ["data", "data sources", "data requirements"],
  constraints: ["constraints", "limitations", "restrictions"],
  desiredOutcomes: ["desired outcomes", "outcomes", "success criteria"],
} as const;

async function run(input: BusinessDiscoveryInput): Promise<BusinessContext> {
  const { parsed } = input;
  const bizSection = getSection(parsed, "business");

  const businessName =
    bizSection?.keyValues["Business Name"] ??
    bizSection?.keyValues["Name"] ??
    parsed.title.replace(/^Project:\s*/i, "").trim();

  const industry = bizSection?.keyValues["Industry"] ?? bizSection?.keyValues["Type"] ?? "";

  const goals = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.goals]));
  const users = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.users]));
  const processes = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.processes]));
  const painPoints = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.painPoints]));
  const existingSystems = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.existingSystems]));
  const businessRules = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.businessRules]));
  const integrations = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.integrations]));
  const data = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.data]));
  const constraints = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.constraints]));
  const desiredOutcomes = sectionEntries(findSection(parsed, [...SECTION_CANDIDATES.desiredOutcomes]));

  const missingInformation: string[] = [];
  if (goals.length === 0) missingInformation.push("goals");
  if (users.length === 0) missingInformation.push("target users");
  if (painPoints.length === 0) missingInformation.push("pain points");
  if (existingSystems.length === 0) missingInformation.push("existing systems");

  return {
    businessName,
    industry,
    goals,
    users,
    processes,
    painPoints,
    existingSystems,
    businessRules,
    integrations,
    data,
    constraints,
    desiredOutcomes,
    missingInformation,
  };
}

export const businessDiscoveryAgent: Agent<BusinessDiscoveryInput, BusinessContext> = {
  name: "BusinessDiscoveryAgent",
  run,
};
