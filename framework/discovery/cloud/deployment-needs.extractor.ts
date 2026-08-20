/**
 * Extracts DeploymentNeed from any of several dedicated headings ("Deployment
 * Requirements", "Runtime Requirements", "Hosting Requirements",
 * "Infrastructure Requirements", "Cloud Requirements", "Environment
 * Requirements", "Scalability Requirements", "Resilience Requirements").
 *
 * Deliberately does NOT use findSection() (framework/discovery/shared/section-lookup.ts),
 * which returns only the first matching alias present. A real document could
 * plausibly use more than one of these as genuinely separate headings (e.g.
 * both "## Deployment Requirements" and "## Scalability Requirements") —
 * findSection()'s "first match wins" behavior would silently drop every
 * heading after the first. This extractor collects entries from every
 * matching heading found instead — a local, documented deviation, not a
 * change to the shared utility every other extractor still uses as-is.
 *
 * Never scans raw Markdown outside these headings — incidental mentions of
 * "AWS"/"server"/"cloud"/"database" elsewhere never become deployment
 * architecture (task item 5).
 */

import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { normalizeHeading, sectionEntries, makeIdGenerator } from "../shared/section-lookup.js";
import type { SystemInventoryItem } from "../systems/system-inventory.types.js";
import type { DeploymentNeed, DeploymentNeedCategory } from "./deployment-need.types.js";

export const DEPLOYMENT_SECTION_HEADINGS = [
  "deployment requirements",
  "runtime requirements",
  "hosting requirements",
  "infrastructure requirements",
  "cloud requirements",
  "environment requirements",
  "scalability requirements",
  "resilience requirements",
] as const;

// Most-specific-first — a bullet mentioning both "environment" and "database"
// language should classify by its most concrete, decision-relevant concern.
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: DeploymentNeedCategory }> = [
  { pattern: /\bpersist\b|\bdurable\b|\bsurvive\b.*\brestarts?\b|\brestarts?\b.*\bsurvive\b|\bdatabase\b/i, category: "persistence" },
  { pattern: /\bpublic(ly)?\b|\bprivate\b|\bendpoint\b|\bexpose\b|\bnetwork\b|\bconnect/i, category: "network" },
  { pattern: /\bconcurrent\b|\bscal|\bthroughput\b|\brequests?\b.*\b(per|\/)\b|\borders?\b.*\b(per|\/)\b|\bload\b/i, category: "scalability" },
  { pattern: /\benvironments?\b/i, category: "environment" },
  { pattern: /\bresilien|\btolerate\b|\bunavailab|\btemporar(y|ily)\b|\bcontinue\b.*\bfail/i, category: "resilience" },
  { pattern: /\bregion\b|\blocation\b|\bresiden(cy|t)\b|\bcountry\b/i, category: "location" },
  { pattern: /\bcloud provider\b|\bprovider\b|\bhost(ed|ing)?\b|\bon.?premises?\b|\bhybrid\b/i, category: "hosting" },
  { pattern: /\bavailab|\buptime\b/i, category: "availability" },
  { pattern: /\bruntime\b|\bapplication\b|\bprocessor\b|\bAPI\b|\bbackground\b|\bworker\b|\bservice\b|\bcomponent\b/i, category: "runtime" },
  { pattern: /\bstorage\b|\bfile\b|\bobject\b|\basset/i, category: "storage" },
  { pattern: /\bcompute\b/i, category: "compute" },
];

function classifyCategory(text: string): DeploymentNeedCategory {
  return CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(text))?.category ?? "unknown";
}

export function extractDeploymentNeeds(parsed: ParsedProject, systems: SystemInventoryItem[]): DeploymentNeed[] {
  const nextId = makeIdGenerator("DEPLOY");
  const needs: DeploymentNeed[] = [];
  const seenDescriptions = new Set<string>();

  for (const heading of DEPLOYMENT_SECTION_HEADINGS) {
    const section = parsed.sections[normalizeHeading(heading)];
    if (!section) continue;

    for (const description of sectionEntries(section)) {
      if (seenDescriptions.has(description)) continue; // same bullet repeated under two aliased headings
      seenDescriptions.add(description);

      needs.push({
        id: nextId(),
        category: classifyCategory(description),
        description,
        relatedSystemIds: systems.filter((s) => description.toLowerCase().includes(s.name.toLowerCase())).map((s) => s.id),
        relatedRequirementIds: [],
        metadata: explicitMetadata(heading, description),
      });
    }
  }

  return needs;
}
