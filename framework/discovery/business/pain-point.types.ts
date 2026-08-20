import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface PainPoint {
  id: string;
  description: string;
  relatedProcessIds: string[];
  metadata: DiscoveryMetadata;
}
