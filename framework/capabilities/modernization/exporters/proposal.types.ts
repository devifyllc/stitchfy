/**
 * Proposal-domain types — a third provenance domain, distinct from
 * Discovery evidence (EvidenceReference) and codebase evidence
 * (CodebaseEvidenceReference). A proposal CITES architecture/codebase
 * evidence; it is never itself an observed fact, and none of these types
 * represent an applied change — see docs/architecture/MODERNIZATION_EXPORTERS.md
 * "Review boundary".
 */

import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { CodebaseEvidenceReference } from "../../../analysis/codebase/contracts/codebase-evidence.types.js";

export type ProposalSource = "architecture" | "codebase-derived" | "architecture-and-codebase";

/** Additive provenance wrapper — never a redesign of EvidenceReference/CodebaseEvidenceReference (task item 68/81). */
export interface ProposalMetadata {
  source: ProposalSource;
  evidenceRefs: CodebaseEvidenceReference[];
  architectureRefs: ArchitectureReference[];
}

// ─── Base change proposal ───────────────────────────────────────────────────

export type ModernizationChangeProposalType = "dependency" | "configuration" | "source" | "build" | "packaging" | "runtime" | "manual-review";
export type ModernizationChangeProposalAction = "add" | "remove" | "modify" | "review" | "preserve";
export type ModernizationChangeProposalStatus = "proposed" | "needs-review" | "blocked";

/** A proposal, never an applied change (task item 14). */
export interface ModernizationChangeProposal {
  id: string;
  type: ModernizationChangeProposalType;
  filePath?: string;
  description: string;
  action: ModernizationChangeProposalAction;
  evidenceRefs: CodebaseEvidenceReference[];
  rationale: string;
  status: ModernizationChangeProposalStatus;
}

/** Never includes complete source files or sensitive content (task item 15). */
export interface FileChangeProposal extends ModernizationChangeProposal {
  filePath: string;
  currentEvidence?: string;
  proposedIntent?: string;
}

// ─── Dependency change ───────────────────────────────────────────────────────

export interface DependencyCoordinate {
  group?: string;
  name: string;
  version?: string;
}

export type DependencyChangeAction = "retain" | "remove" | "replace" | "add" | "review";

/** `proposedDependency.version` is only ever populated when explicit architecture evidence provides it — never fabricated (task item 17). */
export interface DependencyChangeProposal {
  id: string;
  dependencyFactId?: string;
  action: DependencyChangeAction;
  currentDependency?: DependencyCoordinate;
  proposedDependency?: DependencyCoordinate;
  reason: string;
  evidenceRefs: CodebaseEvidenceReference[];
  status: "proposed" | "needs-review" | "blocked";
}

// ─── Configuration change ────────────────────────────────────────────────────

export type ConfigurationChangeAction = "retain" | "review" | "remove" | "replace" | "add";

export interface ConfigurationChangeProposal {
  id: string;
  filePath: string;
  configurationType: string;
  action: ConfigurationChangeAction;
  description: string;
  targetConfiguration?: string;
  evidenceRefs: CodebaseEvidenceReference[];
  status: "proposed" | "needs-review" | "blocked";
}

// ─── Build change ────────────────────────────────────────────────────────────

export interface BuildChangeProposal {
  id: string;
  buildSystem: "maven" | "npm" | "unknown";
  filePath: string;
  action: "review" | "modify" | "retain";
  description: string;
  evidenceRefs: CodebaseEvidenceReference[];
  status: "proposed" | "needs-review";
}

// ─── Source transformation candidate ────────────────────────────────────────

export type SourceTransformationCategory = "namespace" | "runtime-api" | "framework-api" | "server-specific-api" | "configuration-reference" | "unknown";

/**
 * Means "an engineer should evaluate this location" — never "Stitchfy has
 * proven the replacement code" (task item 25). `proposedDirection` stays
 * undefined unless explicit target evidence justifies naming a direction.
 */
export interface SourceTransformationCandidate {
  id: string;
  filePath: string;
  symbol?: string;
  category: SourceTransformationCategory;
  observedState: string;
  proposedDirection?: string;
  evidenceRefs: CodebaseEvidenceReference[];
  status: "review" | "candidate" | "blocked";
}

// ─── Manual review ───────────────────────────────────────────────────────────

/** Used aggressively when safe automation is impossible — preferable to inventing a code change (task item 33). */
export interface ManualReviewItem {
  id: string;
  topic: string;
  description: string;
  affectedFiles: string[];
  reason: string;
  evidenceRefs: CodebaseEvidenceReference[];
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export interface TransformationProposalSet {
  candidateId: string;
  dependencyChanges: DependencyChangeProposal[];
  configurationChanges: ConfigurationChangeProposal[];
  buildChanges: BuildChangeProposal[];
  sourceCandidates: SourceTransformationCandidate[];
  manualReviews: ManualReviewItem[];
  evidenceRefs: CodebaseEvidenceReference[];
}
