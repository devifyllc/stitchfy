/**
 * Extracts IntegrationNeed entries from the "## Integrations" section.
 *
 * Works directly on the section's raw text (like processes.extractor.ts)
 * rather than the bullet-parser's `.items`, so a bullet can optionally be
 * followed by plain "Label: Value" detail lines without changing the
 * simple case: a plain bullet with no follow-up lines produces exactly the
 * same IntegrationNeed as before (`details` stays undefined). A bullet
 * followed by detail lines (e.g. "Integration method: REST over HTTPS")
 * captures them verbatim into `details` — no inference happens here, only
 * capture; framework/capabilities/integrations/ does its own deterministic
 * extraction from these strings.
 */

import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, makeIdGenerator, stripListPrefix, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { SystemInventoryItem } from "../systems/system-inventory.types.js";
import type { IntegrationNeed } from "./integration-need.types.js";

interface RawRecord {
  description: string;
  detailLines: string[];
}

function splitRecords(raw: string): RawRecord[] {
  const records: RawRecord[] = [];
  let current: RawRecord | undefined;

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("-")) {
      if (current) records.push(current);
      current = { description: stripListPrefix(line), detailLines: [] };
    } else if (current) {
      current.detailLines.push(line);
    }
  }
  if (current) records.push(current);

  return records;
}

function parseDetails(detailLines: string[]): Record<string, string> | undefined {
  if (detailLines.length === 0) return undefined;

  const details: Record<string, string> = {};
  for (const line of detailLines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 /-]*):\s*(.+)$/);
    if (match) details[match[1].trim()] = match[2].trim();
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

export function extractIntegrationNeeds(parsed: ParsedProject, systems: SystemInventoryItem[]): IntegrationNeed[] {
  const nextId = makeIdGenerator("INTNEED");
  const section = findSection(parsed, SECTION_CANDIDATES.integrations);
  if (!section) return [];

  return splitRecords(section.raw).map((record) => {
    const description = record.description;
    return {
      id: nextId(),
      description,
      relatedSystemIds: systems.filter((s) => description.toLowerCase().includes(s.name.toLowerCase())).map((s) => s.id),
      details: parseDetails(record.detailLines),
      metadata: explicitMetadata("integrations", description),
    };
  });
}
