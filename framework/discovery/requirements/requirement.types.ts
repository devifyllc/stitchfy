/**
 * Evolved in Phase 1. Dropped the separate flat `source: string` field from
 * the original sketch in favor of `metadata: DiscoveryMetadata` alone —
 * `metadata.sources` already carries provenance, so a second string field
 * would just duplicate it (see ARCHITECTURE.md "Discovery Model").
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export type RequirementType =
  | "functional"
  | "non-functional"
  | "integration"
  | "security"
  | "automation"
  | "data"
  | "operational";

export type RequirementPriority = "must" | "should" | "could" | "wont";

export interface RequirementItem {
  id: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  relatedGoalIds: string[];
  relatedPainPointIds: string[];
  relatedProcessIds: string[];
  acceptanceCriteria: string[];
  metadata: DiscoveryMetadata;
}
