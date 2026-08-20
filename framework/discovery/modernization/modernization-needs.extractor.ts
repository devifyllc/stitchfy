/**
 * Extracts a single, aggregate ModernizationNeed from 12 dedicated heading
 * aliases, partitioned into 6 semantic buckets:
 *
 * 1. general-intent  — "Modernization/Legacy/Migration Requirements",
 *    "Legacy Systems", "Legacy Application". Each bullet is sub-classified:
 *    preservation-language → preservationNeeds; else → desiredOutcomes (this
 *    is where "move from A to B" / "must coexist" sentences land verbatim,
 *    for the capability layer's pattern-matchers to re-scan).
 * 2. goals            — "Modernization/Migration Goals", "Target State
 *    Requirements" → desiredOutcomes.
 * 3. drivers          — "Modernization Drivers" → classified into
 *    ModernizationDriver via an ordered keyword table.
 * 4. debt             — "Technical Debt" → raw technicalDebtSignals; never
 *    turned into a TechnicalDebtItem here (that requires resolving a real
 *    systemId, which only the capability layer, with full system context,
 *    can do safely).
 * 5. constraints      — "Legacy/Migration Constraints" → constraints (raw).
 * 6. preservation     — "Preservation Requirements" → preservationNeeds.
 *
 * Deliberately does NOT use findSection() (same precedent as Phase 7B's
 * deployment-needs.extractor.ts) — collects from every heading present.
 * Exactly one ModernizationNeed is produced when any of the 12 headings has
 * content; zero otherwise. Never scans raw Markdown outside these headings
 * for generic words like "old"/"legacy"/"modern"/"cloud"/"rewrite".
 */

import type { ParsedProject } from "../../core/markdown-parser.js";
import type { DiscoveryMetadata, SourceReference } from "../../core/contracts/provenance.js";
import { normalizeHeading, sectionEntries, makeIdGenerator } from "../shared/section-lookup.js";
import type { SystemInventoryItem } from "../systems/system-inventory.types.js";
import type { ModernizationDriver, ModernizationNeed } from "./modernization-need.types.js";

const GENERAL_INTENT_HEADINGS = ["modernization requirements", "legacy systems", "legacy application", "migration requirements"] as const;
const GOALS_HEADINGS = ["modernization goals", "migration goals", "target state requirements"] as const;
const DRIVERS_HEADINGS = ["modernization drivers"] as const;
const DEBT_HEADINGS = ["technical debt"] as const;
const CONSTRAINTS_HEADINGS = ["legacy constraints", "migration constraints"] as const;
const PRESERVATION_HEADINGS = ["preservation requirements"] as const;

const PRESERVATION_LANGUAGE_PATTERN = /\bmust (remain|stay)\b|\bmust not change\b|\bunchanged\b|\bremain compatible\b|\bmust be compatible\b/i;

const DRIVER_PATTERNS: Array<{ pattern: RegExp; driver: ModernizationDriver }> = [
  { pattern: /\bsecur/i, driver: "security" },
  { pattern: /\bsupport(ability)?\b|\bno longer supported\b|\bunsupported\b/i, driver: "supportability" },
  { pattern: /\breliab/i, driver: "reliability" },
  { pattern: /\bintegrat/i, driver: "integration" },
  { pattern: /\bdeliver|\brelease\b|\bvelocity\b|\bspeed\b/i, driver: "delivery-speed" },
  { pattern: /\bscal/i, driver: "scalability" },
  { pattern: /\bcost\b|\blicens/i, driver: "operational-cost" },
  { pattern: /\btechnical debt\b|\bdebt\b/i, driver: "technical-debt" },
  { pattern: /\bplatform\b|\bend.of.life\b|\blifecycle\b|\bapplication.server\b/i, driver: "platform-lifecycle" },
  { pattern: /\bbusiness\b/i, driver: "business-change" },
  { pattern: /\bmaintain/i, driver: "maintainability" },
];

function classifyDriver(text: string): ModernizationDriver {
  return DRIVER_PATTERNS.find(({ pattern }) => pattern.test(text))?.driver ?? "unknown";
}

function collect(parsed: ParsedProject, headings: readonly string[]): { entries: string[]; headingsUsed: string[] } {
  const entries: string[] = [];
  const headingsUsed: string[] = [];
  for (const heading of headings) {
    const section = parsed.sections[normalizeHeading(heading)];
    if (!section) continue;
    const sectionEntriesList = sectionEntries(section);
    if (sectionEntriesList.length === 0) continue;
    entries.push(...sectionEntriesList);
    headingsUsed.push(heading);
  }
  return { entries, headingsUsed };
}

function aggregateMetadata(headingsUsed: string[]): DiscoveryMetadata {
  const sources: SourceReference[] = headingsUsed.map((section) => ({ sourceType: "input", section }));
  return { confidence: 1, sources, inferred: false };
}

export function extractModernizationNeeds(parsed: ParsedProject, systems: SystemInventoryItem[]): ModernizationNeed[] {
  const generalIntent = collect(parsed, GENERAL_INTENT_HEADINGS);
  const goals = collect(parsed, GOALS_HEADINGS);
  const drivers = collect(parsed, DRIVERS_HEADINGS);
  const debt = collect(parsed, DEBT_HEADINGS);
  const constraints = collect(parsed, CONSTRAINTS_HEADINGS);
  const preservation = collect(parsed, PRESERVATION_HEADINGS);

  const headingsUsed = [...generalIntent.headingsUsed, ...goals.headingsUsed, ...drivers.headingsUsed, ...debt.headingsUsed, ...constraints.headingsUsed, ...preservation.headingsUsed];
  if (headingsUsed.length === 0) return [];

  const desiredOutcomes: string[] = [...goals.entries];
  const preservationNeeds: string[] = [...preservation.entries];

  for (const bullet of generalIntent.entries) {
    if (PRESERVATION_LANGUAGE_PATTERN.test(bullet)) preservationNeeds.push(bullet);
    else desiredOutcomes.push(bullet);
  }

  const driverSet = new Set<ModernizationDriver>();
  for (const bullet of drivers.entries) driverSet.add(classifyDriver(bullet));

  // systemIds is scoped to desiredOutcomes only — a system named only in a
  // preservationNeeds bullet (e.g. "must remain compatible with the
  // Integration Gateway") is a preservation *constraint*, not evidence that
  // system itself is being modernized (task item 66's restraint, generalized
  // beyond just external SaaS systems).
  const systemNameText = desiredOutcomes.join(" ").toLowerCase();
  const systemIds = systems.filter((s) => systemNameText.includes(s.name.toLowerCase())).map((s) => s.id);

  const nextId = makeIdGenerator("MODNEED");

  return [
    {
      id: nextId(),
      systemIds,
      drivers: [...driverSet],
      desiredOutcomes,
      preservationNeeds,
      constraints: [...constraints.entries],
      technicalDebtSignals: [...debt.entries],
      metadata: aggregateMetadata(headingsUsed),
    },
  ];
}
