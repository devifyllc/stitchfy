/**
 * ModernizationPlan — a lightweight planning-stage record of what will be
 * inspected. The real ModernizationArchitecture is only built later, in
 * execute(), once IntegrationDefinition[]/SecurityArchitecture/
 * ObservabilityArchitecture/CloudArchitecture actually exist as sibling
 * output.
 */

import type { SolutionContext } from "../../core/contracts/context.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import type { ModernizationPlan } from "./schemas/modernization.types.js";

export function buildModernizationPlan(context: SolutionContext, assessment: CapabilityAssessment): ModernizationPlan {
  const discovery = context.discoveryResult;

  if (!discovery || (assessment.status !== "recommended" && assessment.status !== "needs-review")) {
    return {
      modernizationNeedIds: [],
      systemIds: [],
      processIds: [],
      integrationIds: [],
      candidateSystemIds: [],
      dependencyIds: [],
      preservationRequirementIds: [],
      informationGapIds: assessment.blockingGapIds,
      assumptions: [],
    };
  }

  const candidateSystemIds = discovery.modernizationNeeds.flatMap((n) => n.systemIds);

  return {
    modernizationNeedIds: discovery.modernizationNeeds.map((n) => n.id),
    systemIds: [...new Set(candidateSystemIds)],
    processIds: [],
    integrationIds: [],
    candidateSystemIds: [...new Set(candidateSystemIds)],
    dependencyIds: [],
    preservationRequirementIds: [],
    informationGapIds: assessment.blockingGapIds,
    assumptions:
      candidateSystemIds.length > 0
        ? ["Real profiles/dependencies/preservation requirements are derived later from IntegrationDefinition[]/SecurityArchitecture/ObservabilityArchitecture/CloudArchitecture, once available."]
        : [],
  };
}
