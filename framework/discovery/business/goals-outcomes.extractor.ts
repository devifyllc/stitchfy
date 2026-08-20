import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { BusinessGoal } from "./business-goal.types.js";
import type { PainPoint } from "./pain-point.types.js";
import type { DesiredOutcome } from "./desired-outcome.types.js";

export function extractGoals(parsed: ParsedProject): BusinessGoal[] {
  const nextId = makeIdGenerator("GOAL");
  const entries = sectionEntries(findSection(parsed, SECTION_CANDIDATES.goals));
  return entries.map((description) => ({
    id: nextId(),
    description,
    metadata: explicitMetadata("goals", description),
  }));
}

export function extractPainPoints(parsed: ParsedProject, nextId: () => string = makeIdGenerator("PP")): PainPoint[] {
  const entries = sectionEntries(findSection(parsed, SECTION_CANDIDATES.painPoints));
  return entries.map((description) => ({
    id: nextId(),
    description,
    relatedProcessIds: [],
    metadata: explicitMetadata("pain-points", description),
  }));
}

/** A pain point named inside a process's own "Pain points:" chunk but not in the top-level Pain Points section — still explicit, different section. */
export function makeProcessPainPoint(description: string, processId: string, nextId: () => string): PainPoint {
  return {
    id: nextId(),
    description,
    relatedProcessIds: [processId],
    metadata: explicitMetadata("business-processes", description),
  };
}

// relatedGoalIds is always [] in Phase 1 — no fuzzy goal↔outcome correlation
// is attempted (see ARCHITECTURE.md "Capability Selection Evolution" /
// Phase 1.5); left as a typed field so a future pass can populate it.
export function extractDesiredOutcomes(parsed: ParsedProject): DesiredOutcome[] {
  const nextId = makeIdGenerator("OUTCOME");
  const entries = sectionEntries(findSection(parsed, SECTION_CANDIDATES.desiredOutcomes));
  return entries.map((description) => ({
    id: nextId(),
    description,
    relatedGoalIds: [],
    metadata: explicitMetadata("desired-outcomes", description),
  }));
}
