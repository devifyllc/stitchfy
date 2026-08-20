/**
 * CapabilityAssessment — the explainable output of asking "should this
 * capability be part of the solution?". Deliberately no numeric score:
 * `status`/`confidence` are derived from how many independent, named signal
 * categories fired (see workflow-automation.assessor.ts for the reference
 * implementation), and every claim is backed by `reasons[].evidenceRefs`
 * pointing at real DiscoveryResult entities.
 */

import type { EvidenceReference } from "../../core/contracts/evidence.js";

export type AssessmentStatus = "recommended" | "not-recommended" | "needs-review" | "blocked";
export type AssessmentConfidence = "low" | "medium" | "high";

/**
 * "structured" — computed from DiscoveryResult via a capability's assess().
 * "legacy-keyword" — synthesized from a capability's supports() boolean by
 *   legacyKeywordAssessment() because that capability hasn't migrated yet.
 * "explicit-request" — reserved for a future explicit user selection
 *   ("include workflow automation regardless") — not produced anywhere yet.
 */
export type AssessmentMethod = "structured" | "legacy-keyword" | "explicit-request";

export interface AssessmentReason {
  code: string;
  description: string;
  evidenceRefs: EvidenceReference[];
}

export interface CapabilityAssessment {
  capabilityId: string;
  status: AssessmentStatus;
  confidence: AssessmentConfidence;
  reasons: AssessmentReason[];
  relatedProcessIds: string[];
  relatedRequirementIds: string[];
  relatedOutcomeIds: string[];
  relatedSystemIds: string[];
  relatedConstraintIds: string[];
  blockingGapIds: string[];
  method: AssessmentMethod;
}
