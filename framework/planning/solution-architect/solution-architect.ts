/**
 * Solution Architect — drafts the initial SolutionBlueprint skeleton from
 * BusinessContext. Populates project + business immediately; every other
 * section is filled in later by the capability registry (see
 * framework/orchestrator/solution-orchestrator.ts) as capabilities execute.
 */

import type { BusinessContext } from "../../discovery/business/business-context.types.js";
import type { ProjectMeta } from "../../schemas/blueprint.types.js";
import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";

export function draftSolutionBlueprint(
  project: ProjectMeta,
  business: BusinessContext
): Partial<SolutionBlueprint> {
  return {
    project,
    business,
    requirements: [],
    processes: [],
    actors: [],
    systems: [],
    constraints: [],
    capabilities: [],
    risks: [],
    artifacts: [],
    qa: { expectedReports: [], knownLimitations: [] },
  };
}
