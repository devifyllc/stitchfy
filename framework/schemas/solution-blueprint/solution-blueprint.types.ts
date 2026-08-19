/**
 * TypeScript interfaces for the Stitchfy Solution Blueprint (v1).
 *
 * Broader than WebsiteBlueprint (framework/schemas/blueprint.types.ts):
 * describes a full business solution that may span multiple capabilities.
 * Website generation remains fully supported — see capabilities/website —
 * it just no longer sits at the center of the model; it contributes to
 * `capabilities` and `artifacts` like any other capability.
 *
 * Most sections are optional: they're only populated once the corresponding
 * capability actually executes (see framework/orchestrator/solution-orchestrator.ts).
 */

import type { ProjectMeta } from "../blueprint.types.js";
import type { BusinessContext } from "../../discovery/business/business-context.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { BusinessProcess } from "../../discovery/processes/business-process.types.js";
import type { BusinessActor } from "../../discovery/actors/business-actor.types.js";
import type { SystemInventoryItem } from "../../discovery/systems/system-inventory.types.js";
import type { Constraint } from "../../discovery/constraints/constraint.types.js";
import type { BusinessRule } from "../../discovery/business-rules/business-rule.types.js";
import type { InformationGap } from "../../discovery/gaps/information-gap.types.js";
import type { TraceabilityLink } from "../../discovery/traceability/traceability.types.js";
import type { CapabilityExecutionResult } from "../capability/capability-result.types.js";
import type { WorkflowAutomationSection } from "../../capabilities/workflow-automation/schemas/workflow-automation.types.js";
import type { AIAgentsSection } from "../../capabilities/ai-agents/schemas/ai-agents.types.js";
import type { IntegrationsSection } from "../../capabilities/integrations/schemas/integrations.types.js";
import type { CloudArchitectureSection } from "../../capabilities/cloud/schemas/cloud.types.js";
import type {
  SecuritySection,
  GovernanceSection,
} from "../../capabilities/security-governance/schemas/security-governance.types.js";
import type { ObservabilitySection } from "../../capabilities/observability/schemas/observability.types.js";
import type { ModernizationSection } from "../../capabilities/modernization/schemas/modernization.types.js";
import type { ImplementationArtifact } from "../../core/contracts/artifact.js";
import type { RiskAssessment } from "../../planning/risk-assessment/risk-assessment.types.js";

export interface DeploymentInfo {
  environments: string[];
  strategy: string;
  notes: string[];
}

export interface SolutionQA {
  expectedReports: string[];
  knownLimitations: string[];
}

export interface SolutionBlueprint {
  project: ProjectMeta;
  business: BusinessContext;
  requirements?: RequirementItem[];
  processes?: BusinessProcess[];
  actors?: BusinessActor[];
  systems?: SystemInventoryItem[];
  constraints?: Constraint[];
  businessRules?: BusinessRule[];
  informationGaps?: InformationGap[];
  traceability?: TraceabilityLink[];
  capabilities?: CapabilityExecutionResult[];
  architecture?: CloudArchitectureSection;
  integrations?: IntegrationsSection;
  automation?: WorkflowAutomationSection;
  ai?: AIAgentsSection;
  security?: SecuritySection;
  governance?: GovernanceSection;
  observability?: ObservabilitySection;
  /** Addition beyond the base field list — see ARCHITECTURE.md "Adaptation". */
  modernization?: ModernizationSection;
  deployment?: DeploymentInfo;
  risks?: RiskAssessment[];
  artifacts?: ImplementationArtifact[];
  qa?: SolutionQA;
}
