/**
 * Normalizes Stitchfy's three independent evidence/reference domains
 * (EvidenceReference, ArchitectureReference, CodebaseEvidenceReference —
 * see framework/core/contracts/evidence.ts and
 * framework/analysis/codebase/contracts/codebase-evidence.types.ts) into one
 * displayable shape. Never merges what they mean: `kind` always says which
 * domain a reference came from, so "why was this decided" (discovery
 * evidence) is never shown as if it were "what file supports this"
 * (codebase evidence).
 */

import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../core/contracts/architecture-reference.js";
import type { CodebaseEvidenceReference } from "../../analysis/codebase/contracts/codebase-evidence.types.js";
import type { EntityIndexEntry, ReportEvidenceRef } from "./types.js";

export function toReportEvidenceRefs(
  refs: EvidenceReference[] | undefined,
  entityIndex: Record<string, EntityIndexEntry>
): ReportEvidenceRef[] {
  if (!refs) return [];
  return refs.map((ref) => ({
    kind: "discovery",
    entityType: ref.entityType,
    entityId: ref.entityId,
    description: ref.description ?? entityIndex[ref.entityId]?.label,
  }));
}

export function toArchitectureReportRefs(refs: ArchitectureReference[] | undefined, entityIndex: Record<string, EntityIndexEntry>): ReportEvidenceRef[] {
  if (!refs) return [];
  return refs.map((ref) => ({
    kind: "architecture",
    entityType: ref.entityType,
    entityId: ref.entityId,
    description: entityIndex[ref.entityId]?.label,
  }));
}

export function toCodebaseReportRefs(refs: CodebaseEvidenceReference[] | undefined): ReportEvidenceRef[] {
  if (!refs) return [];
  return refs.map((ref) => ({
    kind: "codebase",
    entityType: ref.evidenceType,
    entityId: ref.factId ?? ref.filePath,
    description: ref.symbol,
    filePath: ref.filePath,
    line: ref.line,
    symbol: ref.symbol,
  }));
}
