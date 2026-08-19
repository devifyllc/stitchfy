import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface DataEntity {
  id: string;
  name: string;
  description: string;
  /** Deterministic keyword match only (health/payment/PII-style terms) — never a guess. */
  sensitive: boolean;
  metadata: DiscoveryMetadata;
}
