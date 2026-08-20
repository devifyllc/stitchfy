/**
 * Phase 8 — replaces the Phase 0 unstructured model ({systemInventory,
 * dependencies, applications, integrations, technicalDebt, migrationCandidates
 * (free-form recommendedStrategy: string), migrationStrategies, recommendations}
 * as string[] arrays) with a vendor-neutral, evidence-backed
 * ModernizationArchitecture. Modernization answers "should this system
 * change, and if so how" — never assumes legacy = replace/rewrite/cloud/
 * microservices/containerization. A system may be assessed and retained.
 *
 * `implemented: true` means Stitchfy generated and validated a legacy-
 * modernization assessment and migration-strategy architecture from
 * currently known evidence. It does NOT mean application code was analyzed,
 * code was migrated, dependencies were upgraded, databases were converted,
 * tests passed, production behavior was preserved, a target system was
 * deployed, or migration risk was eliminated.
 *
 * Does NOT create a second system inventory — every profile/dependency/
 * candidate references SystemInventoryItem.id (Phase 1); nothing here
 * duplicates name/technology/purpose unnecessarily.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { RiskAssessment } from "../../../planning/risk-assessment/risk-assessment.types.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { ModernizationDriver } from "../../../discovery/modernization/modernization-need.types.js";
import type { CodebaseEvidenceReference } from "../../../analysis/codebase/contracts/codebase-evidence.types.js";
import type { ModernizationExportBundle } from "../exporters/exporter.types.js";

// ─── Planning (modernization.planner.ts) ───────────────────────────────────

export interface ModernizationPlan {
  modernizationNeedIds: string[];
  systemIds: string[];
  processIds: string[];
  integrationIds: string[];
  candidateSystemIds: string[];
  dependencyIds: string[];
  preservationRequirementIds: string[];
  informationGapIds: string[];
  assumptions: string[];
}

// ─── System profile ─────────────────────────────────────────────────────────

export type SystemLifecycleStatus = "supported" | "unsupported" | "end-of-life" | "unknown";

/**
 * References SystemInventoryItem.id — never duplicates name/technology/
 * purpose. `role` reuses SystemInventoryItem.purpose verbatim rather than
 * re-describing it.
 */
export interface SystemModernizationProfile {
  id: string;
  systemId: string;
  modernizationNeedIds: string[];
  role: string;
  lifecycleStatus: SystemLifecycleStatus;
  modernizationDrivers: ModernizationDriver[];
  technicalDebtIds: string[];
  dependencyIds: string[];
  preservationRequirementIds: string[];
  constraintIds: string[];
  evidenceRefs: EvidenceReference[];
  status: "candidate" | "retain" | "needs-review" | "out-of-scope";
  /**
   * Phase 8.5A — references only, never a copy of the underlying facts
   * (task item 79). Populated only when a real CodebaseAnalysisResult was
   * explicitly mapped to this profile's systemId.
   */
  codebaseAnalysis?: {
    analysisId: string;
    frameworkFactIds: string[];
    runtimeFactIds: string[];
    dependencyFactIds: string[];
  };
}

// ─── Technical debt ─────────────────────────────────────────────────────────

export type TechnicalDebtCategory =
  | "architecture"
  | "dependencies"
  | "platform"
  | "integration"
  | "data"
  | "deployment"
  | "testing"
  | "observability"
  | "security"
  | "maintainability"
  | "manual-process"
  | "unknown";

export type TechnicalDebtImpact = "low" | "medium" | "high" | "unknown";

/**
 * Never inferred from technology "looking old" — only from an explicit
 * Technical Debt bullet, or (Phase 8.5A) a narrow, deterministic codebase
 * analysis finding. `evidenceRefs` stays Discovery-only; `codebaseEvidenceRefs`
 * is a small additive field for the second, independent evidence domain —
 * never conflated with the first (task item 80/81).
 */
export interface TechnicalDebtItem {
  id: string;
  systemId: string;
  category: TechnicalDebtCategory;
  description: string;
  impact: TechnicalDebtImpact;
  evidenceRefs: EvidenceReference[];
  codebaseEvidenceRefs?: CodebaseEvidenceReference[];
}

// ─── System dependencies ────────────────────────────────────────────────────

export type SystemDependencyType = "api" | "database" | "file" | "messaging" | "shared-data" | "runtime" | "manual" | "unknown";
export type SystemDependencyDirection = "outbound" | "inbound" | "bidirectional" | "unknown";

/** Derived only from a real IntegrationDefinition — never a source-code/module dependency (no codebase analysis in this phase). */
export interface SystemDependency {
  id: string;
  sourceSystemId: string;
  targetSystemId: string;
  type: SystemDependencyType;
  direction: SystemDependencyDirection;
  integrationId?: string;
  description: string;
  evidenceRefs: EvidenceReference[];
}

// ─── Preservation ────────────────────────────────────────────────────────────

export type PreservationRequirementType =
  | "business-behavior"
  | "business-rule"
  | "integration-contract"
  | "data"
  | "security"
  | "operational"
  | "user-experience"
  | "compatibility"
  | "unknown";

/**
 * Answers "what must not be accidentally lost while changing technology?" —
 * the core Phase 8 concept. `relatedSecurityRequirementIds`/
 * `relatedObservabilityObjectiveIds` are small additive fields (only
 * populated for type "security"/"operational" respectively, only on a real
 * cross-capability id match) — evidenceRefs still only ever cites Discovery,
 * same convention as CloudSecurityMapping/CloudObservabilityMapping (Phase 7B).
 */
export interface PreservationRequirement {
  id: string;
  systemId: string;
  type: PreservationRequirementType;
  description: string;
  sourceArchitectureRefs: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
  relatedSecurityRequirementIds?: string[];
  relatedObservabilityObjectiveIds?: string[];
}

// ─── Seams ───────────────────────────────────────────────────────────────────

export type ModernizationSeamType = "integration-boundary" | "system-boundary" | "data-boundary" | "runtime-boundary" | "unknown";

/** A known boundary that could potentially support incremental modernization — never a source-code/domain-analysis concept (no bounded-context/module-seam invention). */
export interface ModernizationSeam {
  id: string;
  type: ModernizationSeamType;
  description: string;
  architectureRefs: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

// ─── Migration constraints ───────────────────────────────────────────────────

export type MigrationConstraintCategory =
  | "downtime"
  | "compatibility"
  | "data-migration"
  | "release-window"
  | "budget"
  | "business-continuity"
  | "regulatory"
  | "external-dependency"
  | "target-platform"
  | "unknown";

/** `relatedConstraintId` set only on an exact-text match against a real Discovery Constraint — never fabricated. */
export interface MigrationConstraint {
  id: string;
  category: MigrationConstraintCategory;
  description: string;
  relatedConstraintId?: string;
  evidenceRefs: EvidenceReference[];
}

// ─── Strategy ────────────────────────────────────────────────────────────────

export type ModernizationStrategy = "retain" | "retire" | "replace" | "rehost" | "replatform" | "refactor" | "rearchitect" | "encapsulate" | "unknown";

export type ModernizationStrategyOptionStatus = "explicit" | "candidate" | "not-supported" | "needs-review";

/** A system may have multiple plausible options — Stitchfy never forces a single selection when evidence doesn't support one. */
export interface ModernizationStrategyOption {
  strategy: ModernizationStrategy;
  status: ModernizationStrategyOptionStatus;
  rationale: string;
  evidenceRefs: EvidenceReference[];
  prerequisiteIds: string[];
  riskIds: string[];
}

export type MigrationApproach = "incremental" | "parallel" | "big-bang" | "coexistence" | "unknown";

/** Only ever generated from a deterministic "from A to B" match — never a speculative comparison. */
export interface ModernizationDelta {
  id: string;
  systemId: string;
  category: "runtime" | "integration" | "data" | "deployment" | "security" | "observability" | "business-behavior" | "unknown";
  currentState: string;
  targetState: string;
  evidenceRefs: EvidenceReference[];
}

export interface MigrationCandidate {
  id: string;
  systemId: string;
  status: "candidate" | "retain" | "needs-review" | "blocked";
  driverIds: string[];
  strategyOptions: ModernizationStrategyOption[];
  approach: MigrationApproach;
  dependencyIds: string[];
  preservationRequirementIds: string[];
  riskIds: string[];
  informationGapIds: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── Target state ────────────────────────────────────────────────────────────

export type TargetStateCategory = "runtime" | "integration" | "data" | "security" | "observability" | "deployment" | "business-behavior" | "compatibility" | "unknown";

/** Never a full independently-generated target architecture — references Cloud/Security/Observability output, never duplicates it. */
export interface TargetStateRequirement {
  id: string;
  category: TargetStateCategory;
  description: string;
  explicit: boolean;
  relatedSystemIds: string[];
  architectureRefs: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type MigrationValidationType = "behavior" | "integration" | "data" | "security" | "performance" | "operational" | "compatibility" | "unknown";

/** Describes what must be validated during a future migration — does NOT implement tests. */
export interface MigrationValidationRequirement {
  id: string;
  type: MigrationValidationType;
  description: string;
  preservationRequirementIds: string[];
  evidenceRefs: EvidenceReference[];
  codebaseEvidenceRefs?: CodebaseEvidenceReference[];
}

// ─── Codebase evidence conflicts (Phase 8.5A) ──────────────────────────────

/**
 * When business-discovery evidence and repository evidence disagree on the
 * same fact (e.g. Discovery says "Java 11", the repository's compiler
 * config says "8"), neither source is silently treated as authoritative —
 * task item 46.
 */
export type CodebaseEvidenceConflictResolution = "unresolved" | "prefer-discovery" | "prefer-codebase" | "confirmed";

export interface CodebaseEvidenceConflict {
  id: string;
  topic: string;
  discoveryEvidence: EvidenceReference[];
  codebaseEvidence: CodebaseEvidenceReference[];
  description: string;
  resolution: CodebaseEvidenceConflictResolution;
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────

/** `sequence`/`prerequisiteIds` are only ever populated with explicit sequencing evidence — dependency direction alone never determines migration order (never fabricated in this phase; no dates/durations either). */
export interface ModernizationWorkstream {
  id: string;
  name: string;
  systemIds: string[];
  candidateIds: string[];
  objective: string;
  prerequisiteIds: string[];
  sequence?: number;
  evidenceRefs: EvidenceReference[];
}

export interface RoadmapDependency {
  id: string;
  fromWorkstreamId: string;
  toWorkstreamId: string;
  description: string;
  evidenceRefs: EvidenceReference[];
}

export type ModernizationRoadmapStatus = "draft" | "needs-review" | "complete";

export interface ModernizationRoadmap {
  candidateIds: string[];
  workstreams: ModernizationWorkstream[];
  dependencies: RoadmapDependency[];
  validationRequirementIds: string[];
  informationGapIds: string[];
  status: ModernizationRoadmapStatus;
}

// ─── ModernizationArchitecture ──────────────────────────────────────────────

export type ModernizationArchitectureStatus = "draft" | "needs-review" | "complete";

export interface ModernizationArchitecture {
  version: string;
  profiles: SystemModernizationProfile[];
  dependencies: SystemDependency[];
  technicalDebt: TechnicalDebtItem[];
  preservationRequirements: PreservationRequirement[];
  seams: ModernizationSeam[];
  migrationConstraints: MigrationConstraint[];
  migrationCandidates: MigrationCandidate[];
  modernizationDeltas: ModernizationDelta[];
  targetStateRequirements: TargetStateRequirement[];
  validationRequirements: MigrationValidationRequirement[];
  risks: RiskAssessment[];
  roadmap: ModernizationRoadmap;
  informationGaps: InformationGap[];
  evidenceRefs: EvidenceReference[];
  /** Phase 8.5A — always present, empty when no CodebaseAnalysisResult was supplied (byte-compatible with Phase 8 output otherwise). */
  codebaseEvidenceConflicts: CodebaseEvidenceConflict[];
  status: ModernizationArchitectureStatus;
  statusReasons: string[];
}

// ─── Capability output ──────────────────────────────────────────────────────

export interface ModernizationSection {
  implemented: boolean;
  plan?: ModernizationPlan;
  architecture: ModernizationArchitecture;
  artifacts: ImplementationArtifact[];
  notes: string[];
  /** Phase 8.5B — populated only when an explicit `--modernization-export <target>` was requested (never automatic). */
  exports?: ModernizationExportBundle[];
}
