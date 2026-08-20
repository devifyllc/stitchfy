import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface BusinessGoal {
  id: string;
  description: string;
  metadata: DiscoveryMetadata;
}
