/**
 * Assembles the full ModernizationExportBundle: recipe + transformations +
 * test impact + validation plan + 13 generated files (6 json/md pairs +
 * manifest.json), all under output/artifacts/modernization/exporters/ —
 * never inside the analyzed repository (task item 50/51). Every Markdown
 * file states the mandatory review-boundary disclaimer verbatim (task item
 * 49).
 */

import { createArtifact } from "../../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../../core/contracts/artifact.js";
import type { CodebaseAnalysisResult } from "../../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture, MigrationCandidate } from "../../schemas/modernization.types.js";
import type { ModernizationExporter, ModernizationExportBundle, ModernizationExportManifest, GeneratedModernizationFile } from "../exporter.types.js";
import { REVIEW_BOUNDARY_DISCLAIMER } from "../exporter.types.js";
import { assessGenericJavaReplatformReadiness } from "./generic-java-replatform.readiness.js";
import { buildTransformationProposals } from "./generic-java-replatform.transformations.js";
import { buildMigrationRecipe } from "./generic-java-replatform.recipe.js";
import { buildTestImpactSpecification, buildMigrationValidationPlan } from "./generic-java-replatform.test-impact.js";
import type { MigrationRecipe } from "../recipe.types.js";
import type { TransformationProposalSet } from "../proposal.types.js";
import type { TestImpactSpecification, MigrationValidationPlan } from "../test-impact.types.js";

const CAPABILITY_ID = "modernization";

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "repository";
}

// ─── Migration Recipe Markdown (task item 53) ──────────────────────────────

function renderMigrationRecipeMarkdown(recipe: MigrationRecipe, readiness: ModernizationExportBundle["readiness"]): string {
  const lines: string[] = ["# Migration Recipe", "", `> ${REVIEW_BOUNDARY_DISCLAIMER}`, ""];

  lines.push("## Scope", "");
  lines.push(`System: \`${recipe.systemId}\`, candidate: \`${recipe.modernizationCandidateId}\`.`, "");

  lines.push("## Current State", "");
  lines.push(`- Runtime: ${recipe.currentState.runtime ?? "unknown"}`);
  lines.push(`- Frameworks: ${recipe.currentState.frameworks.join(", ") || "none observed"}`);
  lines.push(`- Packaging: ${recipe.currentState.packaging ?? "unknown"}`);
  lines.push("");

  lines.push("## Target State", "");
  lines.push(`- Runtime: ${recipe.targetState.runtime ?? "unknown"}`);
  lines.push(`- Frameworks: ${recipe.targetState.frameworks.join(", ") || "none observed"}`);
  lines.push(`- Packaging: ${recipe.targetState.packaging ?? "unknown"}`);
  for (const note of recipe.targetState.notes) lines.push(`- ${note}`);
  lines.push("");

  lines.push("## Strategy", "");
  lines.push(`**${recipe.strategy}** (Phase 8's own architecture decision — never re-derived by this export).`, "");

  lines.push("## Export Readiness", "");
  lines.push(`**${readiness.status}**`, "");
  for (const reason of readiness.reasons) lines.push(`- _(${reason.severity})_ ${reason.description}`);
  lines.push("");

  lines.push("## Preservation Requirements", "");
  if (recipe.preservationRequirementIds.length === 0) lines.push("None.");
  else for (const id of recipe.preservationRequirementIds) lines.push(`- \`${id}\``);
  lines.push("");

  lines.push("## Proposed Migration Steps", "");
  if (recipe.steps.length === 0) lines.push("None.");
  else
    for (const step of recipe.steps) {
      lines.push(`### ${step.id} — ${step.category} _(${step.confidence})_`, "");
      lines.push(step.description, "");
      if (step.prerequisiteIds.length > 0) lines.push(`Prerequisites: ${step.prerequisiteIds.join(", ")}`, "");
    }

  lines.push("## Build Changes", "");
  lines.push("See `dependency-change-plan.md` and `configuration-change-plan.md` for details.", "");

  lines.push("## Dependency Changes", "");
  lines.push("See `dependency-change-plan.md`.", "");

  lines.push("## Configuration Changes", "");
  lines.push("See `configuration-change-plan.md`.", "");

  lines.push("## Source Review Areas", "");
  lines.push("See `source-review.md`.", "");

  lines.push("## Validation Requirements", "");
  if (recipe.validationRequirementIds.length === 0) lines.push("None.");
  else for (const id of recipe.validationRequirementIds) lines.push(`- \`${id}\``);
  lines.push("");

  lines.push("## Information Gaps", "");
  lines.push(recipe.informationGapIds.length === 0 ? "None." : recipe.informationGapIds.map((id) => `- \`${id}\``).join("\n"), "");

  lines.push("## Evidence", "");
  lines.push(`${recipe.evidenceRefs.length} evidence reference(s)`, "");

  lines.push("## Important Limitations", "");
  lines.push(REVIEW_BOUNDARY_DISCLAIMER, "");

  return lines.join("\n");
}

// ─── Dependency Change Plan Markdown (task item 54) ────────────────────────

function renderDependencyChangePlanMarkdown(transformations: TransformationProposalSet): string {
  const lines: string[] = ["# Dependency Change Plan", "", `> ${REVIEW_BOUNDARY_DISCLAIMER}`, ""];
  const { dependencyChanges } = transformations;

  const retained = dependencyChanges.filter((d) => d.action === "retain");
  lines.push("## Dependencies to Preserve", "");
  if (retained.length === 0) lines.push("None.");
  else for (const d of retained) lines.push(`- ${d.currentDependency?.name}${d.currentDependency?.version ? `@${d.currentDependency.version}` : ""} — ${d.reason}`);
  lines.push("");

  const review = dependencyChanges.filter((d) => d.action === "review");
  lines.push("## Dependencies Requiring Review", "");
  if (review.length === 0) lines.push("None.");
  else for (const d of review) lines.push(`- ${d.currentDependency?.group ? `${d.currentDependency.group}:` : ""}${d.currentDependency?.name}@${d.currentDependency?.version ?? "unresolved"} — ${d.reason}`);
  lines.push("");

  const removed = dependencyChanges.filter((d) => d.action === "remove");
  lines.push("## Proposed Removals", "");
  lines.push(removed.length === 0 ? "None." : removed.map((d) => `- ${d.currentDependency?.name} — ${d.reason}`).join("\n"), "");

  const replaced = dependencyChanges.filter((d) => d.action === "replace");
  lines.push("## Proposed Replacements", "");
  lines.push(replaced.length === 0 ? "None." : replaced.map((d) => `- ${d.currentDependency?.name} → ${d.proposedDependency?.name ?? "unresolved"}`).join("\n"), "");

  const added = dependencyChanges.filter((d) => d.action === "add");
  lines.push("## Proposed Additions", "");
  lines.push(added.length === 0 ? "None." : added.map((d) => `- ${d.proposedDependency?.name ?? "unresolved"} — ${d.reason}`).join("\n"), "");

  const unresolved = dependencyChanges.filter((d) => d.currentDependency?.version === "unresolved");
  lines.push("## Unresolved Versions", "");
  lines.push(unresolved.length === 0 ? "None." : unresolved.map((d) => `- ${d.currentDependency?.group ? `${d.currentDependency.group}:` : ""}${d.currentDependency?.name}`).join("\n"), "");

  lines.push("## Evidence", "");
  lines.push(`${dependencyChanges.flatMap((d) => d.evidenceRefs).length} evidence reference(s)`, "");

  return lines.join("\n");
}

// ─── Configuration Change Plan Markdown (task item 55) ─────────────────────

function renderConfigurationChangePlanMarkdown(transformations: TransformationProposalSet): string {
  const lines: string[] = ["# Configuration Change Plan", "", `> ${REVIEW_BOUNDARY_DISCLAIMER}`, ""];
  const { configurationChanges } = transformations;

  lines.push("## Existing Runtime-Specific Configuration", "");
  lines.push(configurationChanges.length === 0 ? "None identified." : configurationChanges.map((c) => `- \`${c.filePath}\` _(${c.configurationType})_`).join("\n"), "");

  const retain = configurationChanges.filter((c) => c.action === "retain");
  lines.push("## Configuration to Preserve", "");
  lines.push(retain.length === 0 ? "None." : retain.map((c) => `- \`${c.filePath}\``).join("\n"), "");

  const review = configurationChanges.filter((c) => c.action === "review");
  lines.push("## Configuration Requiring Review", "");
  lines.push(review.length === 0 ? "None." : review.map((c) => `- \`${c.filePath}\` — ${c.description}`).join("\n"), "");

  const removed = configurationChanges.filter((c) => c.action === "remove");
  lines.push("## Proposed Removal Candidates", "");
  lines.push(removed.length === 0 ? "None — no configuration file has been established as safe to remove." : removed.map((c) => `- \`${c.filePath}\` — ${c.description}`).join("\n"), "");

  const replaced = configurationChanges.filter((c) => c.action === "replace");
  lines.push("## Proposed Replacement Requirements", "");
  lines.push(replaced.length === 0 ? "None." : replaced.map((c) => `- \`${c.filePath}\` → ${c.targetConfiguration ?? "unresolved"}`).join("\n"), "");

  lines.push("## Unknown Target Configuration", "");
  lines.push("No target-runtime-specific configuration (e.g. server descriptors) is invented — only configuration observed in the repository is referenced above.", "");

  lines.push("## Evidence", "");
  lines.push(`${configurationChanges.flatMap((c) => c.evidenceRefs).length} evidence reference(s)`, "");

  return lines.join("\n");
}

// ─── Source Transformation Review Markdown (task item 56) ─────────────────

function renderSourceReviewMarkdown(transformations: TransformationProposalSet): string {
  const lines: string[] = ["# Source Transformation Review", "", `> ${REVIEW_BOUNDARY_DISCLAIMER}`, ""];
  const { sourceCandidates, manualReviews } = transformations;

  const runtimeApi = sourceCandidates.filter((s) => s.category === "runtime-api");
  lines.push("## Runtime-Specific APIs", "");
  lines.push(runtimeApi.length === 0 ? "None identified." : runtimeApi.map((s) => `- \`${s.filePath}\` — ${s.observedState}`).join("\n"), "");

  const namespace = sourceCandidates.filter((s) => s.category === "namespace");
  lines.push("## Namespace Considerations", "");
  if (namespace.length === 0) lines.push("None identified.");
  else
    for (const s of namespace) {
      lines.push(`- \`${s.filePath}\`${s.symbol ? ` (${s.symbol})` : ""} — ${s.observedState} _(${s.status})_${s.proposedDirection ? ` — proposed: ${s.proposedDirection}` : " — namespace compatibility requires review; no automatic replacement is proposed."}`);
    }
  lines.push("");

  const frameworkApi = sourceCandidates.filter((s) => s.category === "framework-api");
  lines.push("## Framework APIs", "");
  lines.push(frameworkApi.length === 0 ? "None identified." : frameworkApi.map((s) => `- \`${s.filePath}\` — ${s.observedState}`).join("\n"), "");

  const serverSpecific = sourceCandidates.filter((s) => s.category === "server-specific-api");
  lines.push("## Server-Specific References", "");
  lines.push(serverSpecific.length === 0 ? "None identified." : serverSpecific.map((s) => `- \`${s.filePath}\` — ${s.observedState}`).join("\n"), "");

  const configRefs = sourceCandidates.filter((s) => s.category === "configuration-reference");
  lines.push("## Configuration References", "");
  lines.push(configRefs.length === 0 ? "None identified." : configRefs.map((s) => `- \`${s.filePath}\` — ${s.observedState}`).join("\n"), "");

  lines.push("## Manual Review Required", "");
  lines.push(manualReviews.length === 0 ? "None." : manualReviews.map((m) => `- **${m.topic}** — ${m.description} (${m.affectedFiles.join(", ") || "no specific file"})`).join("\n"), "");

  lines.push("## No-Automatic-Transformation Notice", "");
  lines.push("A source transformation candidate means an engineer should evaluate this location during the migration. It does not mean Stitchfy has proven, generated, or applied replacement code — no Java source file has been modified.", "");

  return lines.join("\n");
}

// ─── Test Impact Markdown (task item 57) ───────────────────────────────────

function renderTestImpactMarkdown(testImpact: TestImpactSpecification): string {
  const lines: string[] = ["# Test Impact Specification", "", `> ${REVIEW_BOUNDARY_DISCLAIMER}`, ""];

  lines.push("## Preservation Requirements", "");
  lines.push(testImpact.preservationRequirementIds.length === 0 ? "None." : testImpact.preservationRequirementIds.map((id) => `- \`${id}\``).join("\n"), "");

  const sections: Array<[string, typeof testImpact.testAreas[number]["category"]]> = [
    ["Build Validation", "build"],
    ["Runtime Startup Validation", "startup"],
    ["Business Behavior Validation", "business-behavior"],
    ["Integration Validation", "integration"],
    ["Data Validation", "data"],
    ["Security Validation", "security"],
    ["Observability Validation", "observability"],
    ["Deployment Validation", "deployment"],
  ];
  for (const [heading, category] of sections) {
    const areas = testImpact.testAreas.filter((a) => a.category === category);
    lines.push(`## ${heading}`, "");
    lines.push(areas.length === 0 ? "Not applicable." : areas.map((a) => `- ${a.description}`).join("\n"), "");
  }

  lines.push("## Unresolved Acceptance Criteria", "");
  lines.push("No numeric or literal acceptance criteria (response codes, payload shapes, timing thresholds) are established beyond what the modernization architecture explicitly states.", "");

  return lines.join("\n");
}

// ─── Validation Plan Markdown ───────────────────────────────────────────────

function renderValidationPlanMarkdown(validationPlan: MigrationValidationPlan): string {
  const lines: string[] = ["# Migration Validation Plan", "", `> ${REVIEW_BOUNDARY_DISCLAIMER}`, ""];

  lines.push("## Validation Gates", "");
  if (validationPlan.validationGates.length === 0) lines.push("None identified.");
  else for (const g of validationPlan.validationGates) lines.push(`- **${g.name}** _(${g.status})_ — ${g.description}`);
  lines.push("");

  lines.push("## Existing Validation Requirements", "");
  lines.push(validationPlan.existingValidationRequirementIds.length === 0 ? "None." : validationPlan.existingValidationRequirementIds.map((id) => `- \`${id}\``).join("\n"), "");

  lines.push("## Unresolved Criteria", "");
  lines.push(validationPlan.unresolvedCriteria.length === 0 ? "None." : validationPlan.unresolvedCriteria.map((c) => `- ${c}`).join("\n"), "");

  lines.push("## Notice", "");
  lines.push("No automatic deployment gate or production cutover gate is generated by this export.", "");

  return lines.join("\n");
}

// ─── Manifest ────────────────────────────────────────────────────────────

function buildManifest(
  candidate: MigrationCandidate,
  exporter: ModernizationExporter,
  readiness: ModernizationExportBundle["readiness"],
  transformations: TransformationProposalSet,
  codebase: CodebaseAnalysisResult,
  generatedFiles: string[]
): ModernizationExportManifest {
  return {
    schemaVersion: "1.0",
    modernizationCandidateId: candidate.id,
    systemId: candidate.systemId,
    exporterId: exporter.id,
    exporterVersion: exporter.version,
    strategy: "replatform",
    readiness: readiness.status,
    codebaseAnalysisId: codebase.repository.name,
    preservationRequirementIds: readiness.preservationRequirementIds,
    validationRequirementIds: readiness.validationRequirementIds,
    dependencyChangeIds: transformations.dependencyChanges.map((d) => d.id),
    configurationChangeIds: transformations.configurationChanges.map((c) => c.id),
    sourceCandidateIds: transformations.sourceCandidates.map((s) => s.id),
    informationGapIds: readiness.informationGapIds,
    conflictIds: readiness.conflictIds,
    generatedFiles,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Bundle assembly ────────────────────────────────────────────────────────

export async function buildGenericJavaReplatformBundle(
  candidate: MigrationCandidate,
  architecture: ModernizationArchitecture,
  codebase: CodebaseAnalysisResult,
  exporter: ModernizationExporter
): Promise<ModernizationExportBundle> {
  const readiness = assessGenericJavaReplatformReadiness(candidate, architecture, codebase, exporter.id);
  const transformations = buildTransformationProposals(candidate, architecture, codebase);
  const recipeStatus = readiness.status === "ready" ? "ready" : readiness.status === "blocked" ? "draft" : "needs-review";
  const recipe = buildMigrationRecipe(candidate, architecture, codebase, transformations, recipeStatus);
  const testImpact = buildTestImpactSpecification(candidate, architecture, codebase);
  const validationPlan = buildMigrationValidationPlan(candidate, testImpact, readiness);

  // Artifacts live alongside the rest of Modernization's own output tree per task item 50/51.
  const outputBase = `artifacts/modernization/exporters/${slug(codebase.repository.name)}/${exporter.id}`;

  const recipeMd = renderMigrationRecipeMarkdown(recipe, readiness);
  const depPlanMd = renderDependencyChangePlanMarkdown(transformations);
  const cfgPlanMd = renderConfigurationChangePlanMarkdown(transformations);
  const sourceReviewMd = renderSourceReviewMarkdown(transformations);
  const testImpactMd = renderTestImpactMarkdown(testImpact);
  const validationPlanMd = renderValidationPlanMarkdown(validationPlan);

  const generatedFiles: GeneratedModernizationFile[] = [
    { path: `${outputBase}/migration-recipe.json`, role: "recipe", format: "json" },
    { path: `${outputBase}/migration-recipe.md`, role: "recipe", format: "markdown" },
    { path: `${outputBase}/dependency-change-plan.json`, role: "dependency-plan", format: "json" },
    { path: `${outputBase}/dependency-change-plan.md`, role: "dependency-plan", format: "markdown" },
    { path: `${outputBase}/configuration-change-plan.json`, role: "configuration-plan", format: "json" },
    { path: `${outputBase}/configuration-change-plan.md`, role: "configuration-plan", format: "markdown" },
    { path: `${outputBase}/source-review.json`, role: "source-review", format: "json" },
    { path: `${outputBase}/source-review.md`, role: "source-review", format: "markdown" },
    { path: `${outputBase}/test-impact.json`, role: "test-impact", format: "json" },
    { path: `${outputBase}/test-impact.md`, role: "test-impact", format: "markdown" },
    { path: `${outputBase}/validation-plan.json`, role: "validation-plan", format: "json" },
    { path: `${outputBase}/validation-plan.md`, role: "validation-plan", format: "markdown" },
    { path: `${outputBase}/modernization.manifest.json`, role: "manifest", format: "json" },
  ];

  const manifest = buildManifest(candidate, exporter, readiness, transformations, codebase, generatedFiles.map((f) => f.path));

  const artifacts: ImplementationArtifact[] = [
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${outputBase}/migration-recipe.json`, content: JSON.stringify(recipe, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${outputBase}/migration-recipe.md`, content: recipeMd }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${outputBase}/dependency-change-plan.json`, content: JSON.stringify(transformations.dependencyChanges, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${outputBase}/dependency-change-plan.md`, content: depPlanMd }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${outputBase}/configuration-change-plan.json`, content: JSON.stringify(transformations.configurationChanges, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${outputBase}/configuration-change-plan.md`, content: cfgPlanMd }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${outputBase}/source-review.json`, content: JSON.stringify({ sourceCandidates: transformations.sourceCandidates, manualReviews: transformations.manualReviews }, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${outputBase}/source-review.md`, content: sourceReviewMd }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${outputBase}/test-impact.json`, content: JSON.stringify(testImpact, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${outputBase}/test-impact.md`, content: testImpactMd }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${outputBase}/validation-plan.json`, content: JSON.stringify(validationPlan, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: `${outputBase}/validation-plan.md`, content: validationPlanMd }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: `${outputBase}/modernization.manifest.json`, content: JSON.stringify(manifest, null, 2) }),
  ];

  return {
    id: `${exporter.id}-${candidate.id}`,
    candidateId: candidate.id,
    exporterId: exporter.id,
    readiness,
    recipe,
    transformations,
    testImpact,
    validationPlan,
    files: generatedFiles,
    artifacts,
    notes: [REVIEW_BOUNDARY_DISCLAIMER, `Readiness: ${readiness.status}.`],
  };
}
