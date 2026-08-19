/**
 * EvidenceReference — points a planning decision back at a real
 * DiscoveryResult entity. Every CapabilityAssessment reason must cite at
 * least one of these when it claims a capability applies; there is no
 * numeric score anywhere in the planning layer — an assessment is
 * explainable exactly because it can only point at entities that actually
 * exist (see framework/planning/capability-assessment/).
 *
 * `entityType` is the task's given union plus one addition — "actor" — a
 * real DiscoveryResult entity (BusinessActor) that a hand-off signal needs
 * to cite; not in the original sketch, added for completeness.
 */

export type EvidenceEntityType =
  | "goal"
  | "pain-point"
  | "outcome"
  | "process"
  | "requirement"
  | "system"
  | "constraint"
  | "business-rule"
  | "integration"
  | "information-gap"
  | "actor";

export interface EvidenceReference {
  entityType: EvidenceEntityType;
  entityId: string;
  description?: string;
}
