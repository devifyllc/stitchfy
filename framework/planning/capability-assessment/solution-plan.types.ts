import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type { CapabilityAssessment } from "./capability-assessment.types.js";

export type SolutionDecisionStatus = "selected" | "not-selected" | "deferred" | "blocked";

export interface SolutionDecision {
  id: string;
  capabilityId: string;
  decision: SolutionDecisionStatus;
  rationale: string[];
  evidenceRefs: EvidenceReference[];
}

export interface SolutionPlan {
  generatedAt: string;
  assessments: CapabilityAssessment[];
  selectedCapabilities: string[];
  decisions: SolutionDecision[];
  unresolvedGaps: string[];
}
