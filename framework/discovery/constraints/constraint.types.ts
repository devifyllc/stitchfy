/**
 * Evolved in Phase 1: `category` renamed `type`, enum expanded per the
 * Phase 1 spec (security/operational/data/integration/unknown added).
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export type ConstraintType =
  | "technical"
  | "business"
  | "regulatory"
  | "security"
  | "budget"
  | "timeline"
  | "operational"
  | "data"
  | "integration"
  | "unknown";

export interface Constraint {
  id: string;
  type: ConstraintType;
  description: string;
  metadata: DiscoveryMetadata;
}
