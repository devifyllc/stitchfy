/**
 * Shared heading/section helpers reused by every discovery extractor —
 * factored out of the original business-discovery.agent.ts so each
 * extractor doesn't reimplement heading normalization. Deliberately
 * independent of framework/core/markdown-parser.ts's SECTION_ALIASES
 * (website-pipeline-specific) — additive, doesn't touch that file.
 */

import type { ParsedProject, ParsedSection } from "../../core/markdown-parser.js";

export function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function findSection(parsed: ParsedProject, candidates: readonly string[]): ParsedSection | undefined {
  for (const heading of candidates) {
    const key = normalizeHeading(heading);
    if (parsed.sections[key]) return parsed.sections[key];
  }
  return undefined;
}

// Guards against degenerate bullet-parser artifacts (e.g. a stray line
// starting with punctuation like "-->" from an HTML comment) being picked
// up as a meaningful item — the underlying parser treats any line starting
// with "-" as a list item.
function isMeaningful(entry: string): boolean {
  return entry.trim().length > 1 && /[a-zA-Z0-9]/.test(entry);
}

export function sectionEntries(section: ParsedSection | undefined): string[] {
  if (!section) return [];
  return [...section.items, ...Object.entries(section.keyValues).map(([k, v]) => `${k}: ${v}`)].filter(isMeaningful);
}

/** Heading aliases per Phase 1 item 8 — expanded from the Phase 0 set. */
export const SECTION_CANDIDATES = {
  goals: ["goals", "business goals", "objectives"],
  users: ["users", "target users", "target audience", "customers", "actors"],
  processes: ["processes", "business processes", "workflows"],
  painPoints: ["pain points", "challenges", "problems"],
  existingSystems: ["existing systems", "current systems", "systems", "tech stack", "applications"],
  businessRules: ["business rules", "rules", "policies"],
  integrations: ["integrations", "third-party integrations", "external systems"],
  data: ["data", "data sources", "data requirements"],
  constraints: ["constraints", "limitations", "restrictions"],
  desiredOutcomes: ["desired outcomes", "outcomes", "success criteria"],
  requirements: ["requirements", "functional requirements", "non-functional requirements"],
} as const;

/** Stable, deterministic IDs (re-running discovery on the same input yields the same IDs). */
export function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${String(++counter).padStart(3, "0")}`;
}

/** Strips a leading "- ", "* ", or "1. " list marker from a raw content line. */
export function stripListPrefix(line: string): string {
  return line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}
