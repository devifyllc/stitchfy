/**
 * Evolved in Phase 1. Dropped the separate flat `source: string` field from
 * the original sketch in favor of `metadata: DiscoveryMetadata` alone —
 * `metadata.sources` already carries provenance, so a second string field
 * would just duplicate it (see ARCHITECTURE.md "Discovery Model").
 *
 * Phase 1.5: added `relatedOutcomeIds` so a requirement derived from a
 * DesiredOutcome (see requirements.extractor.ts) keeps a deterministic link
 * back to it — no fuzzy matching, the extractor already knows which outcome
 * produced the requirement.
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export type RequirementType =
  | "functional"
  | "non-functional"
  | "integration"
  | "security"
  | "automation"
  | "data"
  | "operational"
  /** Phase 6 — explicit AI terminology only (never "automat"/"workflow"/"integrat"). */
  | "ai";

export type RequirementPriority = "must" | "should" | "could" | "wont";

export interface RequirementItem {
  id: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  relatedGoalIds: string[];
  relatedPainPointIds: string[];
  relatedProcessIds: string[];
  relatedOutcomeIds: string[];
  acceptanceCriteria: string[];
  metadata: DiscoveryMetadata;
}
