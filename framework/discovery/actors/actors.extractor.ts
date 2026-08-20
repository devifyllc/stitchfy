import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { BusinessActor } from "./business-actor.types.js";

export function extractActors(parsed: ParsedProject, nextId: () => string = makeIdGenerator("ACTOR")): BusinessActor[] {
  const entries = sectionEntries(findSection(parsed, SECTION_CANDIDATES.users));
  return entries.map((description) => ({
    id: nextId(),
    role: description,
    description,
    relatedProcessIds: [],
    metadata: explicitMetadata("users", description),
  }));
}

/**
 * Called by the composing agent when a process mentions an actor name that
 * doesn't match anything already extracted from the top-level Users
 * section. Still explicit (the name was written under the process's own
 * "Actors:" label) — just from a different section, so actorIds never
 * dangles without inventing a fact. Shares the same ACTOR-NNN id sequence
 * as extractActors() via the passed-in `nextId`.
 */
export function makeProcessActor(name: string, nextId: () => string): BusinessActor {
  return {
    id: nextId(),
    role: name,
    description: name,
    relatedProcessIds: [],
    metadata: explicitMetadata("business-processes", name),
  };
}
