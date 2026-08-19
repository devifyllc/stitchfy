/**
 * Phase 5 — replaces the Phase 0 checklist-shaped model (string[] arrays
 * for authentication/authorization/encryption/...) with a real, evidence-
 * backed SecurityArchitecture + GovernancePlan. Security is *derived from
 * the solution already generated* (WorkflowDefinition[]/IntegrationDefinition[]),
 * never a generic checklist — see docs/architecture/ARCHITECTURE.md
 * "Security, Governance and Risk Architecture".
 *
 * `implemented: true` means Stitchfy generated and validated a security/
 * governance architecture for the currently known solution — it does NOT
 * mean the resulting system is secure, compliant, certified, or
 * production-ready (task item 40). Artifacts/docs avoid words like
 * "secure"/"compliant"/"certified" for the same reason (task item 41).
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { RiskAssessment } from "../../../planning/risk-assessment/risk-assessment.types.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";

// ─── Shared reference/gap shapes ────────────────────────────────────────────

/**
 * Every gap this capability would want to raise that already exists
 * (a Discovery gap, or an IntegrationDefinition/WorkflowDefinition gap) is
 * referenced here with `isNew: false` rather than recreated — task item 26.
 * A genuinely new gap (nothing upstream already asked this question) gets
 * `isNew: true` and a fresh `SECGAP-` id.
 */
export interface InformationGapReference {
  gapId: string;
  topic: string;
  question: string;
  isNew: boolean;
}

// ─── SecurityRequirement ────────────────────────────────────────────────────

export type SecurityDomain =
  | "identity"
  | "authorization"
  | "data-protection"
  | "secrets"
  | "integration"
  | "audit"
  | "privacy"
  | "availability"
  | "input-validation"
  | "human-oversight"
  | "unknown";

export type SecurityPriority = "required" | "recommended" | "review";
export type SecurityRequirementStatus = "defined" | "needs-information";

export interface SecurityRequirement {
  id: string;
  domain: SecurityDomain;
  description: string;
  priority: SecurityPriority;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
  status: SecurityRequirementStatus;
}

// ─── Trust boundaries ───────────────────────────────────────────────────────

export type TrustBoundaryClassification = "internal" | "external" | "third-party" | "unknown";

export interface TrustBoundary {
  id: string;
  sourceSystemId?: string;
  targetSystemId?: string;
  integrationId?: string;
  classification: TrustBoundaryClassification;
  dataContractIds: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── Data protection ────────────────────────────────────────────────────────

export type DataClassification = "public" | "internal" | "confidential" | "restricted" | "unknown";

export interface DataProtectionRequirement {
  id: string;
  dataEntityIds: string[];
  dataContractIds: string[];
  classification: DataClassification;
  encryptionInTransit: boolean | "unknown";
  encryptionAtRest: boolean | "unknown";
  retentionRequirement?: string;
  evidenceRefs: EvidenceReference[];
}

// ─── Identity / Authorization ───────────────────────────────────────────────
// Kept as one array with a `kind` discriminator rather than two separate
// arrays — but the *generation rules* stay independent (task item 10):
// an identity signal never spawns an authorization requirement or vice
// versa.

export type IdentityAccessKind = "identity" | "authorization";

export interface IdentityAccessRequirement {
  id: string;
  kind: IdentityAccessKind;
  description: string;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

// ─── Integration security rollup ───────────────────────────────────────────
// A per-integration view referencing SecurityRequirement ids rather than
// duplicating their text (task item 5).

export interface IntegrationSecurityRequirement {
  integrationId: string;
  relatedSecurityRequirementIds: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── Audit ──────────────────────────────────────────────────────────────────
// This is the *generated solution's* runtime audit requirement — distinct
// from Stitchfy's own capability-execution audit trail
// (framework/governance/audit/audit-logger.ts) — task item 20.

export interface AuditRequirement {
  id: string;
  description: string;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

// ─── SecurityArchitecture ───────────────────────────────────────────────────

export type SecurityArchitectureStatus = "draft" | "needs-review" | "complete";

export interface SecurityArchitecture {
  version: string;
  requirements: SecurityRequirement[];
  trustBoundaries: TrustBoundary[];
  dataProtection: DataProtectionRequirement[];
  identityAccess: IdentityAccessRequirement[];
  integrationSecurity: IntegrationSecurityRequirement[];
  auditRequirements: AuditRequirement[];
  risks: RiskAssessment[];
  informationGaps: InformationGapReference[];
  evidenceRefs: EvidenceReference[];
  status: SecurityArchitectureStatus;
  statusReasons: string[];
}

// ─── Governance ─────────────────────────────────────────────────────────────
// Human oversight/decision controls reuse the existing HITL model
// (HumanApprovalRequest/WorkflowApproval/HumanTouchpoint) — never a
// competing approval model (task item 19).

export interface GovernanceApprovalControl {
  id: string;
  description: string;
  workflowId?: string;
  approvalId?: string;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

export interface DecisionControl {
  id: string;
  description: string;
  decisionId?: string;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

/** Derived from a real BusinessRule — never a generic best-practice statement (task item 18). */
export interface GovernancePolicy {
  id: string;
  description: string;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

export type ComplianceStatus = "explicit" | "potential" | "unknown";

export interface ComplianceConsideration {
  id: string;
  /** Only set for status "explicit" — never assigned for "potential" (task items 14/15). */
  framework?: string;
  status: ComplianceStatus;
  rationale: string;
  evidenceRefs: EvidenceReference[];
}

export type GovernancePlanStatus = "draft" | "needs-review" | "complete";

/**
 * Phase 6 — AI-agent-specific governance controls (task item 33). Consumes
 * AIAgentDefinition[] as-is; never regenerates agent architecture, never a
 * competing approval domain (cross-references the agent's own human
 * oversight entries, which already wrap the existing HumanApprovalRequest).
 */
export type AIAgentGovernanceControlType = "tool-invocation" | "human-approval" | "decision" | "memory" | "output-review" | "scope";

export interface AIAgentGovernanceControl {
  id: string;
  agentId: string;
  type: AIAgentGovernanceControlType;
  description: string;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

export interface GovernancePlan {
  policies: GovernancePolicy[];
  humanOversight: GovernanceApprovalControl[];
  auditRequirements: AuditRequirement[];
  decisionControls: DecisionControl[];
  complianceConsiderations: ComplianceConsideration[];
  informationGaps: string[];
  /** Additive Phase 6 field — undefined when no AI agent architecture exists yet. */
  aiAgentControls?: AIAgentGovernanceControl[];
  status: GovernancePlanStatus;
}

// ─── Capability output ──────────────────────────────────────────────────────

export interface SecurityGovernanceOutput {
  implemented: boolean;
  security: SecurityArchitecture;
  governance: GovernancePlan;
  artifacts: ImplementationArtifact[];
  notes: string[];
}
