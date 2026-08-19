import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface DesiredOutcome {
  id: string;
  description: string;
  relatedGoalIds: string[];
  metadata: DiscoveryMetadata;
}
