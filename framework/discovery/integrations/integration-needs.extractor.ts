import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { SystemInventoryItem } from "../systems/system-inventory.types.js";
import type { IntegrationNeed } from "./integration-need.types.js";

export function extractIntegrationNeeds(parsed: ParsedProject, systems: SystemInventoryItem[]): IntegrationNeed[] {
  const nextId = makeIdGenerator("INTNEED");
  const entries = sectionEntries(findSection(parsed, SECTION_CANDIDATES.integrations));
  return entries.map((description) => ({
    id: nextId(),
    description,
    relatedSystemIds: systems.filter((s) => description.toLowerCase().includes(s.name.toLowerCase())).map((s) => s.id),
    metadata: explicitMetadata("integrations", description),
  }));
}
