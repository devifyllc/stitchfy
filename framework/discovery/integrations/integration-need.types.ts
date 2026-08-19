import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface IntegrationNeed {
  id: string;
  description: string;
  relatedSystemIds: string[];
  metadata: DiscoveryMetadata;
}
