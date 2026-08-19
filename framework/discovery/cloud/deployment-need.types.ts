/**
 * DeploymentNeed — Discovery's explicit record of a stated deployment/
 * runtime/operational requirement, captured only from a dedicated section
 * (see deployment-needs.extractor.ts). Never inferred from incidental
 * mentions of "AWS"/"server"/"cloud"/"database" elsewhere in Markdown —
 * those never become deployment architecture on their own (task item 5).
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export type DeploymentNeedCategory =
  | "hosting"
  | "runtime"
  | "compute"
  | "storage"
  | "persistence"
  | "network"
  | "environment"
  | "scalability"
  | "resilience"
  | "availability"
  | "location"
  | "unknown";

export interface DeploymentNeed {
  id: string;
  category: DeploymentNeedCategory;
  description: string;
  relatedSystemIds: string[];
  relatedRequirementIds: string[];
  metadata: DiscoveryMetadata;
}
