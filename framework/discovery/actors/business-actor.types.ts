/**
 * Canonical actor representation. Replaces the Phase-0 placeholder `Actor`
 * type that lived in framework/schemas/solution-blueprint/solution-blueprint.types.ts
 * (id/role/description only, unused elsewhere) — SolutionBlueprint.actors
 * now references this type directly rather than maintaining two actor
 * shapes. See docs/architecture/ARCHITECTURE.md "Discovery Model".
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface BusinessActor {
  id: string;
  role: string;
  description: string;
  relatedProcessIds: string[];
  metadata: DiscoveryMetadata;
}
