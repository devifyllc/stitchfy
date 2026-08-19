import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { BusinessRule } from "./business-rule.types.js";

const BUSINESS_RULES_CANDIDATES = SECTION_CANDIDATES.businessRules;

export function extractBusinessRules(
  parsed: ParsedProject,
  nextId: () => string = makeIdGenerator("BR")
): BusinessRule[] {
  const entries = sectionEntries(findSection(parsed, BUSINESS_RULES_CANDIDATES));
  return entries.map((description) => ({
    id: nextId(),
    description,
    relatedProcessIds: [],
    metadata: explicitMetadata("business-rules", description),
  }));
}

/**
 * A rule found inside a process's own "Business rules:" chunk — see
 * processes.extractor.ts. Still explicit (the user wrote this line), just
 * located inside a process block instead of a dedicated top-level section.
 */
export function makeProcessBusinessRule(description: string, processId: string, nextId: () => string): BusinessRule {
  return {
    id: nextId(),
    description,
    relatedProcessIds: [processId],
    metadata: explicitMetadata("business-processes", description),
  };
}
