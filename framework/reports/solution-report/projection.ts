/**
 * Assembles the full SolutionReportProjection from a validated
 * SolutionBlueprint — the one function the HTML renderer depends on. Pure:
 * no I/O, no randomness, no capability logic re-run (see
 * docs/architecture/ARCHITECTURE.md "Solution Report").
 */

import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";
import type { ImplementationArtifact } from "../../core/contracts/artifact.js";
import type { ArtifactGroup, SolutionReportProjection, SummaryMetric } from "./types.js";
import { buildEntityIndex } from "./entity-index.js";
import { buildCapabilityCards } from "./capability-view.js";
import { buildBacklog } from "./backlog-view.js";
import { pluralize } from "./format.js";

function metric(singularLabel: string, value: number): SummaryMetric | undefined {
  return value > 0 ? { label: pluralize(singularLabel, value), value } : undefined;
}

function buildArtifactGroups(blueprint: SolutionBlueprint): ArtifactGroup[] {
  const byCapability = new Map<string, { capabilityName: string; paths: Set<string> }>();

  const add = (capabilityId: string, capabilityName: string, artifacts: ImplementationArtifact[] | undefined) => {
    if (!artifacts || artifacts.length === 0) return;
    const entry = byCapability.get(capabilityId) ?? { capabilityName, paths: new Set<string>() };
    for (const artifact of artifacts) {
      if (artifact.path) entry.paths.add(artifact.path);
    }
    byCapability.set(capabilityId, entry);
  };

  for (const result of blueprint.capabilities ?? []) {
    const output = result.output as { artifacts?: ImplementationArtifact[] } | undefined;
    add(result.capabilityId, result.capabilityName, output?.artifacts);
  }

  // Top-level artifacts (rare today — see solution-blueprint.types.ts — but not guaranteed empty forever).
  const topLevelByCapability = new Map<string, ImplementationArtifact[]>();
  for (const artifact of blueprint.artifacts ?? []) {
    const list = topLevelByCapability.get(artifact.capabilityId) ?? [];
    list.push(artifact);
    topLevelByCapability.set(artifact.capabilityId, list);
  }
  for (const [capabilityId, artifacts] of topLevelByCapability) {
    const name = (blueprint.capabilities ?? []).find((c) => c.capabilityId === capabilityId)?.capabilityName ?? capabilityId;
    add(capabilityId, name, artifacts);
  }

  return Array.from(byCapability.entries())
    .map(([capabilityId, { capabilityName, paths }]) => ({
      capabilityId,
      capabilityName,
      paths: Array.from(paths).sort(),
    }))
    .sort((a, b) => a.capabilityName.localeCompare(b.capabilityName));
}

export function buildSolutionReportProjection(blueprint: SolutionBlueprint): SolutionReportProjection {
  const entityIndex = buildEntityIndex(blueprint);
  const capabilities = buildCapabilityCards(blueprint, entityIndex);
  const backlog = buildBacklog(blueprint, entityIndex);
  const artifactGroups = buildArtifactGroups(blueprint);

  const goalSummary = blueprint.business.desiredOutcomes[0] ?? blueprint.business.goals[0] ?? undefined;

  const riskCount = backlog.filter((i) => i.type === "Risk").length;
  const gapCount = backlog.filter((i) => i.type === "Information Gap").length;
  const workItemCount = backlog.filter((i) => i.type === "Workstream" || i.type === "Implementation Step").length;
  const validationCount = backlog.filter((i) => i.type === "Validation Requirement" || i.type === "Validation Gate").length;
  const artifactCount = artifactGroups.reduce((sum, g) => sum + g.paths.length, 0);

  const summary = [
    metric("assessed capability", blueprint.planning?.assessments.length ?? 0),
    metric("selected capability", blueprint.planning?.selectedCapabilities.length ?? 0),
    metric("discovered system", blueprint.systems?.length ?? 0),
    metric("requirement", blueprint.requirements?.length ?? 0),
    metric("integration", blueprint.integrations?.integrations.length ?? 0),
    metric("risk", riskCount),
    metric("open question", gapCount),
    metric("implementation item", workItemCount),
    metric("validation item", validationCount),
    metric("generated artifact", artifactCount),
  ].filter((m): m is SummaryMetric => m !== undefined);

  return {
    project: {
      businessName: blueprint.business.businessName,
      industry: blueprint.business.industry || undefined,
      sourceFile: blueprint.project.sourceFile,
      frameworkVersion: blueprint.project.frameworkVersion,
      schemaVersion: blueprint.project.schemaVersion,
      generatedAt: blueprint.project.generatedAt,
      goalSummary,
    },
    summary,
    capabilities,
    backlog,
    artifactGroups,
    entityIndex,
    unresolvedGapIds: blueprint.planning?.unresolvedGaps ?? [],
  };
}
