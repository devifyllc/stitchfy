/**
 * Deterministic validation beyond the Zod shape check — same {ok, issues}
 * pattern as every prior validator (task item 95). The two rules unique to
 * this domain: any concrete target version/technology in a proposal must
 * trace to a real ModernizationDelta/TargetStateRequirement, and `remove`
 * is never used without deterministic justification.
 */

import type { ModernizationArchitecture } from "../../schemas/modernization.types.js";
import type { CodebaseAnalysisResult } from "../../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationExportBundle } from "../exporter.types.js";

export interface ModernizationExportValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ModernizationExportValidationResult {
  ok: boolean;
  issues: ModernizationExportValidationIssue[];
}

const ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]|^\//;
const CREDENTIAL_LITERAL_PATTERN = /\b(password|secret|token|apiKey|api_key)\s*[:=]\s*["'][^"'\s]{4,}["']/i;

function checkUniqueIds(ids: string[], label: string): ModernizationExportValidationIssue[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]): ModernizationExportValidationIssue => ({ code: "duplicate-id", message: `${label} id "${id}" is used ${count} times`, severity: "error" }));
}

export function validateModernizationExportBundle(
  bundle: ModernizationExportBundle,
  architecture: ModernizationArchitecture,
  codebase: CodebaseAnalysisResult
): ModernizationExportValidationResult {
  const issues: ModernizationExportValidationIssue[] = [];

  const candidateIds = new Set(architecture.migrationCandidates.map((c) => c.id));
  if (!candidateIds.has(bundle.candidateId)) {
    issues.push({ code: "unknown-candidate", message: `ModernizationExportBundle "${bundle.id}" references unknown candidate "${bundle.candidateId}"`, severity: "error" });
  }

  const preservationIds = new Set(architecture.preservationRequirements.map((p) => p.id));
  const validationIds = new Set(architecture.validationRequirements.map((v) => v.id));
  const conflictIds = new Set(architecture.codebaseEvidenceConflicts.map((c) => c.id));
  const codebaseFactIds = new Set([...codebase.frameworks.map((f) => f.id), ...codebase.runtimes.map((r) => r.id), ...codebase.dependencies.map((d) => d.id), ...codebase.sourceStructure.map((s) => s.id)]);

  for (const id of bundle.readiness.preservationRequirementIds) {
    if (!preservationIds.has(id)) issues.push({ code: "unknown-preservation", message: `Readiness references unknown preservation requirement "${id}"`, severity: "error" });
  }
  for (const id of bundle.readiness.validationRequirementIds) {
    if (!validationIds.has(id)) issues.push({ code: "unknown-validation-requirement", message: `Readiness references unknown validation requirement "${id}"`, severity: "error" });
  }
  for (const id of bundle.readiness.conflictIds) {
    if (!conflictIds.has(id)) issues.push({ code: "unknown-conflict", message: `Readiness references unknown conflict "${id}"`, severity: "error" });
  }
  for (const id of bundle.readiness.codebaseFactIds) {
    if (!codebaseFactIds.has(id)) issues.push({ code: "unknown-codebase-fact", message: `Readiness references unknown codebase fact "${id}"`, severity: "error" });
  }

  // Proposal id uniqueness.
  issues.push(...checkUniqueIds(bundle.transformations.dependencyChanges.map((d) => d.id), "DependencyChangeProposal"));
  issues.push(...checkUniqueIds(bundle.transformations.configurationChanges.map((c) => c.id), "ConfigurationChangeProposal"));
  issues.push(...checkUniqueIds(bundle.transformations.buildChanges.map((b) => b.id), "BuildChangeProposal"));
  issues.push(...checkUniqueIds(bundle.transformations.sourceCandidates.map((s) => s.id), "SourceTransformationCandidate"));
  issues.push(...checkUniqueIds(bundle.transformations.manualReviews.map((m) => m.id), "ManualReviewItem"));
  issues.push(...checkUniqueIds(bundle.recipe.steps.map((s) => s.id), "MigrationRecipeStep"));

  // Generated-file path uniqueness + repository-relative-ness (never absolute).
  const filePaths = bundle.files.map((f) => f.path);
  issues.push(...checkUniqueIds(filePaths, "GeneratedModernizationFile"));
  for (const file of bundle.files) {
    if (ABSOLUTE_PATH_PATTERN.test(file.path)) issues.push({ code: "absolute-path-leak", message: `Generated file path "${file.path}" looks like an absolute path`, severity: "error" });
  }

  // No absolute path / credential literal anywhere in the serialized bundle content.
  const serialized = JSON.stringify({ recipe: bundle.recipe, transformations: bundle.transformations, testImpact: bundle.testImpact, validationPlan: bundle.validationPlan });
  if (CREDENTIAL_LITERAL_PATTERN.test(serialized)) {
    issues.push({ code: "possible-secret-literal", message: `ModernizationExportBundle "${bundle.id}" contains what looks like a credential literal`, severity: "error" });
  }

  // Source-file evidence paths must be repository-relative.
  for (const evidenceRef of [...bundle.transformations.evidenceRefs, ...bundle.recipe.evidenceRefs, ...bundle.testImpact.evidenceRefs]) {
    if (ABSOLUTE_PATH_PATTERN.test(evidenceRef.filePath)) {
      issues.push({ code: "absolute-path-leak", message: `Evidence reference filePath "${evidenceRef.filePath}" looks like an absolute path`, severity: "error" });
    }
  }

  // Target technology/version provenance — any concrete version string in a dependency/configuration proposal
  // must trace to real architecture text (a ModernizationDelta's currentState/targetState).
  const architectureVersionText = architecture.modernizationDeltas.map((d) => `${d.currentState} ${d.targetState}`).join(" ");
  for (const dep of bundle.transformations.dependencyChanges) {
    const proposedVersion = dep.proposedDependency?.version;
    if (proposedVersion && proposedVersion !== "unresolved" && !architectureVersionText.includes(proposedVersion)) {
      issues.push({ code: "unsupported-target-version", message: `DependencyChangeProposal "${dep.id}" proposes version "${proposedVersion}" with no supporting architecture evidence`, severity: "error" });
    }
  }

  // `remove` action requires deterministic justification — never emitted without evidence in this exporter,
  // checked generically here as defense-in-depth (task item 98).
  for (const cfg of bundle.transformations.configurationChanges) {
    if (cfg.action === "remove" && cfg.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-removal", message: `ConfigurationChangeProposal "${cfg.id}" proposes removal with no supporting evidence`, severity: "error" });
    }
  }
  for (const dep of bundle.transformations.dependencyChanges) {
    if (dep.action === "remove" && dep.evidenceRefs.length === 0) {
      issues.push({ code: "unsupported-removal", message: `DependencyChangeProposal "${dep.id}" proposes removal with no supporting evidence`, severity: "error" });
    }
  }

  // Strategy immutability check (defense-in-depth — the exporter itself never writes to MigrationCandidate).
  const candidate = architecture.migrationCandidates.find((c) => c.id === bundle.candidateId);
  if (candidate && !candidate.strategyOptions.some((o) => o.strategy === "replatform")) {
    issues.push({ code: "strategy-mismatch", message: `ModernizationExportBundle "${bundle.id}" was generated for a candidate whose strategy options no longer include "replatform"`, severity: "error" });
  }

  // Manifest self-consistency.
  const manifestArtifact = bundle.artifacts.find((a) => a.path?.endsWith("modernization.manifest.json"));
  if (manifestArtifact) {
    const manifest = JSON.parse(manifestArtifact.content as string) as { generatedFiles: string[]; dependencyChangeIds: string[]; configurationChangeIds: string[]; sourceCandidateIds: string[] };
    for (const path of manifest.generatedFiles) {
      if (!filePaths.includes(path)) issues.push({ code: "manifest-mismatch", message: `Manifest lists file "${path}" not present in the bundle`, severity: "error" });
    }
    const realDependencyIds = new Set(bundle.transformations.dependencyChanges.map((d) => d.id));
    for (const id of manifest.dependencyChangeIds) {
      if (!realDependencyIds.has(id)) issues.push({ code: "manifest-mismatch", message: `Manifest lists dependency change "${id}" not present in the bundle`, severity: "error" });
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
