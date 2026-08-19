/**
 * ModernizationExporter — converts an already-reviewed ModernizationArchitecture
 * + CodebaseAnalysisResult into reviewable, implementation-oriented
 * artifacts for a specific technical target (Phase 8.5B). Deliberately NOT
 * a SourceTransformer: nothing here mutates the analyzed repository — see
 * docs/architecture/MODERNIZATION_EXPORTERS.md "Exporter versus
 * Transformer". The exporter never decides whether-or-how to modernize —
 * that decision already exists in ModernizationArchitecture (Phase 8);
 * this layer only proposes implementation work an engineer should review.
 *
 * Contract deliberately threads `candidate` through explicitly (the task's
 * own sketch takes only `(architecture, codebase)`, but
 * `ModernizationExportReadiness.modernizationCandidateId` is singular and
 * the orchestration policy iterates per MigrationCandidate) — an invited
 * adaptation, not a deviation.
 */

import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { CodebaseEvidenceReference } from "../../../analysis/codebase/contracts/codebase-evidence.types.js";
import type { CodebaseAnalysisResult } from "../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture, MigrationCandidate, ModernizationStrategy } from "../schemas/modernization.types.js";
import type { MigrationRecipe } from "./recipe.types.js";
import type { TransformationProposalSet } from "./proposal.types.js";
import type { TestImpactSpecification, MigrationValidationPlan } from "./test-impact.types.js";

/**
 * Closed union so a future target (java-jakarta, spring-boot, java-runtime-upgrade,
 * node-runtime-upgrade, application-server-migration, database-migration-plan,
 * dotnet-modernization, ...) is a type-level change here plus a new
 * registered exporter — never an open string (task item 5).
 */
export type ModernizationExportTarget = "generic-java-replatform";

export type ModernizationExportReadinessStatus = "ready" | "needs-review" | "blocked" | "unsupported";

/** Mirrors ExportReadinessReason (Phase 5.5A) — an "info" tier that never affects `status`. */
export interface ModernizationReadinessReason {
  code: string;
  description: string;
  severity: "info" | "warning" | "blocking";
  architectureRefs: ArchitectureReference[];
  evidenceRefs?: CodebaseEvidenceReference[];
}

export interface ModernizationExportReadiness {
  modernizationCandidateId: string;
  exporterId: string;
  status: ModernizationExportReadinessStatus;
  reasons: ModernizationReadinessReason[];
  preservationRequirementIds: string[];
  validationRequirementIds: string[];
  informationGapIds: string[];
  codebaseFactIds: string[];
  conflictIds: string[];
}

export type GeneratedModernizationFileRole = "recipe" | "dependency-plan" | "configuration-plan" | "source-review" | "test-impact" | "validation-plan" | "manifest";
export type GeneratedModernizationFileFormat = "json" | "markdown";

/**
 * The persisted shape carries no `content` — the same text lives once, in
 * the parallel ImplementationArtifact (ModernizationExportBundle.artifacts)
 * — same precedent Phase 5.5A's GeneratedSourceFile already established
 * (task item 46).
 */
export interface GeneratedModernizationFile {
  path: string;
  role: GeneratedModernizationFileRole;
  format: GeneratedModernizationFileFormat;
  content?: string;
}

export interface ModernizationExportBundle {
  id: string;
  candidateId: string;
  exporterId: string;
  readiness: ModernizationExportReadiness;
  recipe: MigrationRecipe;
  transformations: TransformationProposalSet;
  testImpact: TestImpactSpecification;
  validationPlan: MigrationValidationPlan;
  files: GeneratedModernizationFile[];
  artifacts: ImplementationArtifact[];
  notes: string[];
}

export interface ModernizationExportManifest {
  schemaVersion: "1.0";
  modernizationCandidateId: string;
  systemId: string;
  exporterId: string;
  exporterVersion: string;
  strategy: ModernizationStrategy;
  readiness: ModernizationExportReadinessStatus;
  codebaseAnalysisId?: string;
  preservationRequirementIds: string[];
  validationRequirementIds: string[];
  dependencyChangeIds: string[];
  configurationChangeIds: string[];
  sourceCandidateIds: string[];
  informationGapIds: string[];
  conflictIds: string[];
  generatedFiles: string[];
  generatedAt: string;
}

export interface ModernizationExporter<TOptions = unknown, TResult = ModernizationExportBundle> {
  id: string;
  name: string;
  version: string;
  target: ModernizationExportTarget;

  supports(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): boolean;

  assessReadiness(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): ModernizationExportReadiness;

  export(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult, options?: TOptions): Promise<TResult>;
}

/** Mandatory disclaimer every export bundle's Markdown must state verbatim (task item 49). */
export const REVIEW_BOUNDARY_DISCLAIMER =
  "These artifacts are proposed modernization changes generated from the currently known modernization architecture and repository evidence. They have not been applied to the source repository and have not been proven correct by compilation, testing, deployment, or runtime validation.";
