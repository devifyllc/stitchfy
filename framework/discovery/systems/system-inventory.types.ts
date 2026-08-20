/**
 * Evolved in Phase 1. `category` (was `type`) is classified by a small
 * deterministic keyword table (see systems.extractor.ts) — the same
 * precedent as intake.agent.ts's detectComplianceFlags. `technology` is
 * never guessed: it stays undefined unless explicitly given. `external` is
 * optional rather than a forced boolean, specifically so we never have to
 * silently guess a fact we don't have.
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export type SystemCategory =
  | "application"
  | "saas"
  | "database"
  | "api"
  | "spreadsheet"
  | "manual"
  | "legacy"
  | "cloud-service"
  | "unknown";

export type SystemCriticality = "low" | "medium" | "high";

export interface SystemInventoryItem {
  id: string;
  name: string;
  category: SystemCategory;
  purpose: string;
  owner?: string;
  technology?: string;
  external?: boolean;
  integrations: string[];
  dataHandled: string[];
  criticality?: SystemCriticality;
  metadata: DiscoveryMetadata;
}
