/**
 * Solution Architect — drafts the initial SolutionBlueprint from a
 * DiscoveryResult. As of Phase 1, requirements/processes/actors/systems/
 * constraints/businessRules/informationGaps/traceability are populated
 * directly from the discovery result's own arrays (no independent
 * re-derivation — see docs/architecture/ARCHITECTURE.md "Discovery Model").
 * `business` is the compact BusinessContext projection, kept for backward
 * compatibility with the capability `supports()` checks.
 */

import { deriveBusinessContext } from "../../discovery/discovery-result.types.js";
import type { DiscoveryResult } from "../../discovery/discovery-result.types.js";
import type { ProjectMeta } from "../../schemas/blueprint.types.js";
import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";

export function draftSolutionBlueprint(
  project: ProjectMeta,
  discoveryResult: DiscoveryResult
): Partial<SolutionBlueprint> {
  return {
    project,
    business: deriveBusinessContext(discoveryResult),
    requirements: discoveryResult.requirements,
    processes: discoveryResult.processes,
    actors: discoveryResult.actors,
    systems: discoveryResult.systems,
    constraints: discoveryResult.constraints,
    businessRules: discoveryResult.businessRules,
    informationGaps: discoveryResult.informationGaps,
    traceability: discoveryResult.traceability,
    capabilities: [],
    risks: [],
    artifacts: [],
    qa: { expectedReports: [], knownLimitations: [] },
  };
}
