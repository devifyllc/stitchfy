/**
 * Evolved in Phase 5 from the Phase 0 placeholder
 * ({id, capabilityId?, description, level, mitigation?}) — safe to
 * reshape because nothing ever populated the old shape (assessRisks()
 * always returned []). No numeric risk score anywhere: likelihood/impact
 * are independently "unknown"-preserving, never multiplied into a single
 * number (task item 16).
 */

import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../core/contracts/architecture-reference.js";

export type RiskCategory = "security" | "privacy" | "operational" | "integration" | "data" | "governance";
export type RiskLikelihood = "low" | "medium" | "high" | "unknown";
export type RiskImpact = "low" | "medium" | "high" | "unknown";
export type RiskTreatment = "mitigate" | "accept" | "avoid" | "transfer" | "review";
export type RiskStatus = "open" | "accepted" | "mitigated" | "needs-review";

export interface RiskAssessment {
  id: string;
  category: RiskCategory;
  description: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  treatment: RiskTreatment;
  relatedArchitectureRefs: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
  status: RiskStatus;
}
