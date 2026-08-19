/**
 * Explicit "## Requirements" section → one RequirementItem per line
 * (sourceType "input"). No such section → one RequirementItem derived per
 * DesiredOutcome (sourceType "derived", confidence 0.5) — never invents
 * requirements that aren't grounded in an explicit desired outcome, and
 * never silently treats the derived ones as equivalent to explicit ones
 * (see metadata.sources[0].sourceType).
 */

import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata, derivedMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { DesiredOutcome } from "../business/desired-outcome.types.js";
import type { RequirementItem, RequirementPriority, RequirementType } from "./requirement.types.js";

const TYPE_PATTERNS: Array<{ pattern: RegExp; type: RequirementType }> = [
  { pattern: /secur|encrypt|auth|password/i, type: "security" },
  { pattern: /integrat|api|webhook|sync/i, type: "integration" },
  { pattern: /automat/i, type: "automation" },
  { pattern: /\bdata\b|storage|report/i, type: "data" },
  { pattern: /uptime|performance|scalab|reliab|availab/i, type: "non-functional" },
  { pattern: /staff|hours|operational|approval|manual/i, type: "operational" },
];

const PRIORITY_PATTERNS: Array<{ pattern: RegExp; priority: RequirementPriority }> = [
  { pattern: /\bmust\b|mandatory|required\b/i, priority: "must" },
  { pattern: /\bcould\b|nice to have|optional/i, priority: "could" },
  { pattern: /\bwon'?t\b|out of scope/i, priority: "wont" },
];

function classifyType(text: string): RequirementType {
  return TYPE_PATTERNS.find(({ pattern }) => pattern.test(text))?.type ?? "functional";
}

function classifyPriority(text: string): RequirementPriority {
  return PRIORITY_PATTERNS.find(({ pattern }) => pattern.test(text))?.priority ?? "should";
}

export function extractRequirements(parsed: ParsedProject, desiredOutcomes: DesiredOutcome[]): RequirementItem[] {
  const nextId = makeIdGenerator("REQ");
  const explicitSection = findSection(parsed, SECTION_CANDIDATES.requirements);

  if (explicitSection) {
    const entries = sectionEntries(explicitSection);
    return entries.map((description) => ({
      id: nextId(),
      description,
      type: classifyType(description),
      priority: classifyPriority(description),
      relatedGoalIds: [],
      relatedPainPointIds: [],
      relatedProcessIds: [],
      relatedOutcomeIds: [],
      acceptanceCriteria: [],
      metadata: explicitMetadata("requirements", description),
    }));
  }

  // No explicit Requirements section — derive one requirement per desired
  // outcome rather than leaving the array empty. relatedOutcomeIds is the
  // deterministic link back to the outcome that produced it (no fuzzy
  // matching needed — the outcome object is already in scope here).
  return desiredOutcomes.map((outcome) => ({
    id: nextId(),
    description: `Support: ${outcome.description}`,
    type: classifyType(outcome.description),
    priority: "should" as RequirementPriority,
    relatedGoalIds: outcome.relatedGoalIds,
    relatedPainPointIds: [],
    relatedProcessIds: [],
    relatedOutcomeIds: [outcome.id],
    acceptanceCriteria: [],
    metadata: derivedMetadata("desired-outcomes", outcome.description, 0.5),
  }));
}
