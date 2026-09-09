/**
 * Transient view-model types for the Solution Report (reports/solution-report.html).
 *
 * Nothing here is persisted or re-validated — it exists only to make
 * `SolutionBlueprint` easy to render. Every field is derived by reading an
 * existing blueprint field; this layer never computes a new architectural
 * conclusion (status/priority/risk-level/recommendation). See
 * docs/architecture/ARCHITECTURE.md "Solution Report".
 */

import type { EvidenceReference } from "../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../core/contracts/architecture-reference.js";
import type { CodebaseEvidenceReference } from "../../analysis/codebase/contracts/codebase-evidence.types.js";

export interface ReportEvidenceRef {
  kind: "discovery" | "codebase" | "architecture";
  entityType: string;
  entityId: string;
  description?: string;
  /** Only present for codebase evidence. */
  filePath?: string;
  line?: number;
  symbol?: string;
}

/** One row in the Executive Summary — only ever added when its count is > 0. */
export interface SummaryMetric {
  label: string;
  value: number;
}

export interface CapabilityCard {
  capabilityId: string;
  capabilityName: string;
  /** From CapabilityAssessment.status — never remapped ("recommended" stays "recommended", never "implemented"). */
  assessmentStatus?: string;
  assessmentConfidence?: string;
  assessmentMethod?: string;
  /** From CapabilityExecutionResult — a distinct axis from assessmentStatus (task: "recommended" vs "executed" must not collapse). */
  executionStatus: "executed" | "skipped" | "failed";
  executionSuccess: boolean;
  summary?: string;
  error?: string;
  reasons: { code: string; description: string; evidenceRefs: ReportEvidenceRef[] }[];
  relatedSystemIds: string[];
  relatedRequirementIds: string[];
  relatedOutcomeIds: string[];
  relatedProcessIds: string[];
  relatedConstraintIds: string[];
  blockingGapIds: string[];
  /** Small counter chips, e.g. "3 risks", "6 open questions" — only ever built from real array lengths. */
  metrics: SummaryMetric[];
  artifactPaths: string[];
  implemented?: boolean;
  /** ModernizationArchitecture.status / ObservabilityArchitecture.status / etc. — "draft" | "needs-review" | "complete", verbatim. */
  architectureStatus?: string;
  statusReasons?: string[];
}

export type BacklogItemType =
  | "Workstream"
  | "Implementation Step"
  | "Requirement"
  | "Security Requirement"
  | "Target-State Requirement"
  | "Validation Requirement"
  | "Validation Gate"
  | "Test Impact"
  | "Modernization Delta"
  | "Technical Debt Finding"
  | "Change Proposal"
  | "Manual Review"
  | "Integration Action"
  | "Observability Requirement"
  | "Risk"
  | "Information Gap"
  | "Architecture Decision";

export interface BacklogItem {
  id: string;
  type: BacklogItemType;
  /** Every capability this item is associated with — merged, never overwritten, on id collision across sections. */
  capabilityIds: string[];
  title: string;
  description?: string;
  category?: string;
  /** Only ever set from a real *Priority field — never derived from impact/severity. */
  priority?: string;
  /** Only ever set from a real *Impact field — kept separate from priority so the two concepts never collapse into one column. */
  impact?: string;
  /** RiskAssessment.likelihood only — kept separate from impact/priority (task: likelihood and impact are independently "unknown"-preserving, never multiplied into one score). */
  likelihood?: string;
  status?: string;
  /**
   * "explicit" | "derived" | "candidate" | "needs-review" | "requires-review" | ... — copied
   * verbatim from source, never invented. Deliberately not a generic
   * "confidence" column: no backlog item type carries a real
   * AssessmentConfidence value (that concept lives only on
   * CapabilityAssessment, shown on the Capabilities view) — labeling this
   * "Confidence" here would collapse two distinct concepts into one (task:
   * "Do not collapse these concepts into a fake generic status").
   */
  explicitness?: string;
  rationale: string[];
  relatedSystemIds: string[];
  relatedRequirementIds: string[];
  architectureRefs: ReportEvidenceRef[];
  evidenceRefs: ReportEvidenceRef[];
  prerequisiteIds: string[];
  preservationRequirementIds: string[];
  validationRequirementIds: string[];
  riskIds: string[];
  informationGapIds: string[];
  blocking?: boolean;
  /** The original source object, kept only for the detail drawer's generic fallback view — never re-interpreted, always rendered escaped. */
  raw: unknown;
}

export interface ProjectHeader {
  businessName: string;
  industry?: string;
  sourceFile: string;
  frameworkVersion: string;
  schemaVersion: string;
  generatedAt: string;
  goalSummary?: string;
}

export interface ArtifactGroup {
  capabilityId: string;
  capabilityName: string;
  paths: string[];
}

export interface EntityIndexEntry {
  id: string;
  label: string;
  kind: string;
}

export interface SolutionReportProjection {
  project: ProjectHeader;
  summary: SummaryMetric[];
  capabilities: CapabilityCard[];
  backlog: BacklogItem[];
  artifactGroups: ArtifactGroup[];
  entityIndex: Record<string, EntityIndexEntry>;
  /** Verbatim from SolutionPlan.unresolvedGaps — surfaced separately since it's a named blueprint concept. */
  unresolvedGapIds: string[];
}

// Re-exported for convenience in downstream modules that only need the wire shape.
export type { EvidenceReference, ArchitectureReference, CodebaseEvidenceReference };
