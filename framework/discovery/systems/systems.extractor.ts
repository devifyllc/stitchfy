import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { SystemCategory, SystemInventoryItem } from "./system-inventory.types.js";

// Deterministic keyword → category classification, same precedent as
// intake.agent.ts's detectComplianceFlags. Never guesses `technology`.
// "legacy" is checked first, against name+purpose combined (every other
// pattern only ever looked at `name`) — Phase 8 needs a real, explicit
// "legacy" classification signal (e.g. "Category: legacy application" in the
// source text), which nothing produced before this addition.
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: SystemCategory }> = [
  { pattern: /\blegacy\b/i, category: "legacy" },
  { pattern: /calendar|crm|whatsapp|instagram|facebook|mailchimp|slack|notion/i, category: "saas" },
  { pattern: /spreadsheet|excel|sheets/i, category: "spreadsheet" },
  { pattern: /\bphone\b|in[- ]person|manual|paper/i, category: "manual" },
  { pattern: /website|web app|portal/i, category: "application" },
  { pattern: /database|\bsql\b|postgres|mysql|mongo/i, category: "database" },
  { pattern: /\bapi\b/i, category: "api" },
];

function classifyCategory(name: string, purpose = ""): SystemCategory {
  const legacyText = `${name} ${purpose}`;
  const legacyMatch = CATEGORY_PATTERNS[0];
  if (legacyMatch.pattern.test(legacyText)) return legacyMatch.category;
  for (const { pattern, category } of CATEGORY_PATTERNS.slice(1)) {
    if (pattern.test(name)) return category;
  }
  return "unknown";
}

export function extractSystems(
  parsed: ParsedProject,
  nextId: () => string = makeIdGenerator("SYS")
): SystemInventoryItem[] {
  const section = findSection(parsed, SECTION_CANDIDATES.existingSystems);
  const items: SystemInventoryItem[] = [];

  // Bold key-value entries ("- **Google Calendar:** scheduling") give an
  // explicit purpose; plain items only give a name.
  for (const [name, purpose] of Object.entries(section?.keyValues ?? {})) {
    items.push({
      id: nextId(),
      name,
      category: classifyCategory(name, purpose),
      purpose,
      integrations: [],
      dataHandled: [],
      metadata: explicitMetadata("existing-systems", `${name}: ${purpose}`),
    });
  }
  for (const name of section?.items ?? []) {
    items.push({
      id: nextId(),
      name,
      category: classifyCategory(name),
      purpose: "",
      integrations: [],
      dataHandled: [],
      metadata: explicitMetadata("existing-systems", name),
    });
  }

  return items;
}

/**
 * Entry for a system named inside a process's "Current systems:" chunk but
 * not present in the top-level Existing Systems section — still explicit
 * (named directly by the user), just from a different section.
 */
export function makeProcessSystem(name: string, nextId: () => string): SystemInventoryItem {
  return {
    id: nextId(),
    name,
    category: classifyCategory(name),
    purpose: "",
    integrations: [],
    dataHandled: [],
    metadata: explicitMetadata("business-processes", name),
  };
}
