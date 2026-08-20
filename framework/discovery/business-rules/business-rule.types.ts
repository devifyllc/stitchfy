import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface BusinessRule {
  id: string;
  description: string;
  relatedProcessIds: string[];
  metadata: DiscoveryMetadata;
}
