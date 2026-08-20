/**
 * MigrationRecipe generation — no dates, no duration estimates (task item
 * 12). Steps only get a logical prerequisite order where technically
 * deterministic: validation depends on the review steps, never an
 * invented schedule (task item 13).
 */

import { makeIdGenerator } from "../../../../discovery/shared/section-lookup.js";
import type { CodebaseAnalysisResult } from "../../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture, MigrationCandidate } from "../../schemas/modernization.types.js";
import type { MigrationRecipe, MigrationRecipeStep, ModernizationStateSummary } from "../recipe.types.js";
import type { TransformationProposalSet } from "../proposal.types.js";
import { findRuntimeDelta } from "./generic-java-replatform.exporter.js";

export function buildMigrationRecipe(
  candidate: MigrationCandidate,
  architecture: ModernizationArchitecture,
  codebase: CodebaseAnalysisResult,
  transformations: TransformationProposalSet,
  recipeStatus: MigrationRecipe["status"]
): MigrationRecipe {
  const delta = findRuntimeDelta(candidate, architecture)!;
  const nextStepId = makeIdGenerator("STEP");

  const frameworkNames = [...new Set(codebase.frameworks.map((f) => f.name))];
  const packaging = codebase.buildSystems.find((b) => b.packaging)?.packaging;
  const versionSpecified = /\d/.test(delta.targetState);

  const currentState: ModernizationStateSummary = { runtime: delta.currentState, frameworks: frameworkNames, packaging, notes: [] };
  const targetState: ModernizationStateSummary = {
    runtime: delta.targetState,
    frameworks: frameworkNames,
    packaging,
    notes: [
      "Frameworks not explicitly requiring change are assumed to carry forward pending compatibility review.",
      ...(versionSpecified ? [] : [`Target runtime "${delta.targetState}" version is not specified in the modernization architecture.`]),
    ],
  };

  const steps: MigrationRecipeStep[] = [];

  const runtimeStep: MigrationRecipeStep = {
    id: nextStepId(),
    category: "runtime",
    description: `Review runtime configuration and dependencies for compatibility with the target runtime (${delta.currentState} → ${delta.targetState}).`,
    changeProposalIds: [],
    prerequisiteIds: [],
    preservationRequirementIds: [],
    validationRequirementIds: [],
    evidenceRefs: codebase.runtimes.find((r) => r.type === "application-server")?.metadata.evidenceRefs ?? [],
    confidence: "derived",
  };
  steps.push(runtimeStep);

  let configStep: MigrationRecipeStep | undefined;
  if (transformations.configurationChanges.length > 0) {
    configStep = {
      id: nextStepId(),
      category: "configuration",
      description: "Review runtime-specific configuration for removal or replacement under the target runtime.",
      changeProposalIds: transformations.configurationChanges.map((c) => c.id),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      evidenceRefs: transformations.configurationChanges.flatMap((c) => c.evidenceRefs),
      confidence: "derived",
    };
    steps.push(configStep);
  }

  const dependencyStep: MigrationRecipeStep = {
    id: nextStepId(),
    category: "dependency",
    description: "Review direct dependencies for target-runtime compatibility; no dependency versions have been changed automatically.",
    changeProposalIds: transformations.dependencyChanges.map((d) => d.id),
    prerequisiteIds: [],
    preservationRequirementIds: [],
    validationRequirementIds: [],
    evidenceRefs: transformations.dependencyChanges.flatMap((d) => d.evidenceRefs),
    confidence: "requires-review",
  };
  steps.push(dependencyStep);

  let sourceStep: MigrationRecipeStep | undefined;
  if (transformations.sourceCandidates.length > 0) {
    sourceStep = {
      id: nextStepId(),
      category: "source",
      description: "Review Servlet API usage for target-runtime and namespace compatibility.",
      changeProposalIds: transformations.sourceCandidates.map((s) => s.id),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      evidenceRefs: transformations.sourceCandidates.flatMap((s) => s.evidenceRefs),
      confidence: "requires-review",
    };
    steps.push(sourceStep);
  }

  const preservationRequirementIds = architecture.preservationRequirements.filter((p) => p.systemId === candidate.systemId).map((p) => p.id);
  const validationRequirementIds = architecture.validationRequirements.filter((v) => v.preservationRequirementIds.some((id) => preservationRequirementIds.includes(id))).map((v) => v.id);

  const validationStep: MigrationRecipeStep = {
    id: nextStepId(),
    category: "validation",
    description: "Validate preserved business behavior, integration contracts, and data technology after migration.",
    changeProposalIds: [],
    prerequisiteIds: [runtimeStep.id, configStep?.id, dependencyStep.id, sourceStep?.id].filter((id): id is string => Boolean(id)),
    preservationRequirementIds,
    validationRequirementIds,
    evidenceRefs: [],
    confidence: "derived",
  };
  steps.push(validationStep);

  if (transformations.manualReviews.length > 0) {
    steps.push({
      id: nextStepId(),
      category: "manual-review",
      description: "Complete the manual review items identified for this migration before proceeding.",
      changeProposalIds: [],
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      evidenceRefs: transformations.manualReviews.flatMap((m) => m.evidenceRefs),
      confidence: "requires-review",
    });
  }

  const evidenceRefs = steps.flatMap((s) => s.evidenceRefs);

  return {
    id: "RECIPE-001",
    modernizationCandidateId: candidate.id,
    systemId: candidate.systemId,
    strategy: "replatform",
    currentState,
    targetState,
    steps,
    preservationRequirementIds,
    validationRequirementIds,
    informationGapIds: architecture.informationGaps.map((g) => g.id),
    evidenceRefs,
    status: recipeStatus,
  };
}
