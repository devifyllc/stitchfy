import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { DataEntity } from "./data-entity.types.js";

// Deterministic keyword match only — never a guess about what data is
// handled, only a flag on data explicitly named as such.
const SENSITIVE_PATTERN = /health|medical|payment|credit card|ssn|social security|passport|personal\b/i;

export function extractDataEntities(parsed: ParsedProject): DataEntity[] {
  const nextId = makeIdGenerator("DATA");
  const entries = sectionEntries(findSection(parsed, SECTION_CANDIDATES.data));
  return entries.map((description) => ({
    id: nextId(),
    name: description,
    description,
    sensitive: SENSITIVE_PATTERN.test(description),
    metadata: explicitMetadata("data", description),
  }));
}
