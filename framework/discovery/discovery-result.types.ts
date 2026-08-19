/**
 * DiscoveryResult is the source of truth for everything Business Discovery
 * produces. BusinessContext (framework/discovery/business/business-context.types.ts)
 * is kept as a *derived* flat projection — see deriveBusinessContext() below
 * — so the 7 keyword-matching capabilities that already read
 * `context.businessContext?.goals` etc. as plain string[] keep working
 * unchanged. Nothing here is re-extracted independently from
 * BusinessContext; BusinessContext is computed FROM this, once, in one
 * place, avoiding duplicate extraction logic.
 */

import type { BusinessContext } from "./business/business-context.types.js";
import type { BusinessGoal } from "./business/business-goal.types.js";
import type { PainPoint } from "./business/pain-point.types.js";
import type { DesiredOutcome } from "./business/desired-outcome.types.js";
import type { BusinessActor } from "./actors/business-actor.types.js";
import type { BusinessProcess } from "./processes/business-process.types.js";
import type { RequirementItem } from "./requirements/requirement.types.js";
import type { SystemInventoryItem } from "./systems/system-inventory.types.js";
import type { Constraint } from "./constraints/constraint.types.js";
import type { BusinessRule } from "./business-rules/business-rule.types.js";
import type { DataEntity } from "./data/data-entity.types.js";
import type { IntegrationNeed } from "./integrations/integration-need.types.js";
import type { InformationGap } from "./gaps/information-gap.types.js";
import type { TraceabilityLink } from "./traceability/traceability.types.js";

export interface DiscoveryResult {
  businessName: string;
  industry: string;
  goals: BusinessGoal[];
  painPoints: PainPoint[];
  desiredOutcomes: DesiredOutcome[];
  actors: BusinessActor[];
  processes: BusinessProcess[];
  requirements: RequirementItem[];
  systems: SystemInventoryItem[];
  integrationNeeds: IntegrationNeed[];
  dataEntities: DataEntity[];
  constraints: Constraint[];
  businessRules: BusinessRule[];
  informationGaps: InformationGap[];
  traceability: TraceabilityLink[];
}

/**
 * The sole place BusinessContext gets computed. Every array is flattened to
 * its `description`/`name` strings — the same shape the Phase 0 capabilities
 * already expect.
 */
export function deriveBusinessContext(result: DiscoveryResult): BusinessContext {
  const missingInformation: string[] = [];
  if (result.goals.length === 0) missingInformation.push("goals");
  if (result.actors.length === 0) missingInformation.push("target users");
  if (result.painPoints.length === 0) missingInformation.push("pain points");
  if (result.systems.length === 0) missingInformation.push("existing systems");

  return {
    businessName: result.businessName,
    industry: result.industry,
    goals: result.goals.map((g) => g.description),
    users: result.actors.map((a) => (a.role ? `${a.role}: ${a.description}` : a.description)),
    processes: result.processes.map((p) => p.name),
    painPoints: result.painPoints.map((p) => p.description),
    existingSystems: result.systems.map((s) => s.name),
    businessRules: result.businessRules.map((r) => r.description),
    integrations: result.integrationNeeds.map((i) => i.description),
    data: result.dataEntities.map((d) => d.name),
    constraints: result.constraints.map((c) => c.description),
    desiredOutcomes: result.desiredOutcomes.map((o) => o.description),
    missingInformation,
  };
}
