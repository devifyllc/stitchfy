/**
 * Dependency/configuration/build/source proposals + manual reviews for the
 * generic Java replatform exporter. Every rule here is restraint-first:
 * `retain`/`review` are the default, `remove`/`replace` require
 * deterministic evidence, and no target version/technology is ever
 * invented (task items 17-33).
 */

import { makeIdGenerator } from "../../../../discovery/shared/section-lookup.js";
import type { CodebaseAnalysisResult } from "../../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { ModernizationArchitecture, MigrationCandidate } from "../../schemas/modernization.types.js";
import type { DependencyChangeProposal, ConfigurationChangeProposal, BuildChangeProposal, SourceTransformationCandidate, ManualReviewItem, TransformationProposalSet } from "../proposal.types.js";
import { findRuntimeDelta } from "./generic-java-replatform.exporter.js";

const FRAMEWORK_DEPENDENCY_RETAIN_PATTERN = /^(spring framework|spring boot|hibernate)$/i;
const SERVLET_FRAMEWORK_PATTERN = /^servlet api/i;
const JAKARTA_TARGET_PATTERN = /jakarta/i;

function isJakartaTargetExplicit(candidate: MigrationCandidate, architecture: ModernizationArchitecture): boolean {
  return architecture.modernizationDeltas.some((d) => d.systemId === candidate.systemId && JAKARTA_TARGET_PATTERN.test(d.targetState));
}

export function buildTransformationProposals(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): TransformationProposalSet {
  const delta = findRuntimeDelta(candidate, architecture);

  const nextDepId = makeIdGenerator("DEPCHANGE");
  const nextCfgId = makeIdGenerator("CFGCHANGE");
  const nextBuildId = makeIdGenerator("BUILDCHANGE");
  const nextSrcId = makeIdGenerator("SRCCHANGE");
  const nextReviewId = makeIdGenerator("MANUALREVIEW");

  // ─── Dependency changes ────────────────────────────────────────────────
  const dependencyChanges: DependencyChangeProposal[] = [];
  const directDeps = codebase.dependencies.filter((d) => d.direct === true);

  for (const dep of directDeps) {
    if (dep.version === "unresolved") {
      dependencyChanges.push({
        id: nextDepId(),
        dependencyFactId: dep.id,
        action: "review",
        currentDependency: { group: dep.group, name: dep.name, version: dep.version },
        reason: "Dependency version could not be resolved locally; review required before migration proceeds.",
        evidenceRefs: dep.metadata.evidenceRefs,
        status: "needs-review",
      });
      continue;
    }

    const isServletApi = dep.group?.includes("servlet") || dep.name.toLowerCase().includes("servlet");
    if (isServletApi) {
      dependencyChanges.push({
        id: nextDepId(),
        dependencyFactId: dep.id,
        action: "review",
        currentDependency: { group: dep.group, name: dep.name, version: dep.version },
        reason: "Servlet API compatibility with the target runtime requires review; no target Servlet API version is specified.",
        evidenceRefs: dep.metadata.evidenceRefs,
        status: "needs-review",
      });
      continue;
    }
  }

  for (const framework of codebase.frameworks.filter((f) => FRAMEWORK_DEPENDENCY_RETAIN_PATTERN.test(f.name))) {
    dependencyChanges.push({
      id: nextDepId(),
      action: "retain",
      currentDependency: { name: framework.name, version: framework.version },
      reason: "No modernization evidence requires changing this dependency.",
      evidenceRefs: framework.metadata.evidenceRefs,
      status: "proposed",
    });
  }

  // ─── Configuration changes — WebSphere-specific descriptors only ───────
  const configurationChanges: ConfigurationChangeProposal[] = [];
  const webSphereRuntime = codebase.runtimes.find((r) => r.type === "application-server" && r.name === "WebSphere");
  if (webSphereRuntime) {
    for (const ref of webSphereRuntime.metadata.evidenceRefs) {
      configurationChanges.push({
        id: nextCfgId(),
        filePath: ref.filePath,
        configurationType: "application-server-descriptor",
        action: "review",
        description: "WebSphere-specific configuration requires review for the target runtime.",
        evidenceRefs: [ref],
        status: "needs-review",
      });
    }
  }

  // ─── Build changes — packaging preserved unless architecture says otherwise ──
  const buildChanges: BuildChangeProposal[] = [];
  for (const buildSystem of codebase.buildSystems) {
    if (buildSystem.packaging) {
      buildChanges.push({
        id: nextBuildId(),
        buildSystem: buildSystem.type === "maven" || buildSystem.type === "npm" ? buildSystem.type : "unknown",
        filePath: buildSystem.descriptorPath,
        action: "retain",
        description: `Current packaging (${buildSystem.packaging}) is preserved; no packaging change is specified by the modernization architecture.`,
        evidenceRefs: buildSystem.metadata.evidenceRefs,
        status: "proposed",
      });
    }
    buildChanges.push({
      id: nextBuildId(),
      buildSystem: buildSystem.type === "maven" || buildSystem.type === "npm" ? buildSystem.type : "unknown",
      filePath: buildSystem.descriptorPath,
      action: "review",
      description: "Review build configuration for target-runtime compatibility.",
      evidenceRefs: buildSystem.metadata.evidenceRefs,
      status: "needs-review",
    });
  }

  // ─── Source transformation candidates — Servlet API namespace ──────────
  const sourceCandidates: SourceTransformationCandidate[] = [];
  const jakartaExplicit = delta ? isJakartaTargetExplicit(candidate, architecture) : false;
  const servletFrameworks = codebase.frameworks.filter((f) => SERVLET_FRAMEWORK_PATTERN.test(f.name) && f.detectionMethod === "import");

  for (const framework of servletFrameworks) {
    for (const ref of framework.metadata.evidenceRefs) {
      sourceCandidates.push({
        id: nextSrcId(),
        filePath: ref.filePath,
        symbol: ref.symbol,
        category: "namespace",
        observedState: `${ref.symbol ?? framework.name} import observed.`,
        proposedDirection: jakartaExplicit ? "javax.servlet.* → jakarta.servlet.*" : undefined,
        evidenceRefs: [ref],
        status: jakartaExplicit ? "candidate" : "review",
      });
    }
  }

  // ─── Manual reviews — aggressive use where safe automation is impossible ──
  const manualReviews: ManualReviewItem[] = [];
  if (webSphereRuntime) {
    manualReviews.push({
      id: nextReviewId(),
      topic: "WebSphere-specific configuration and Servlet API compatibility",
      description: "Server-specific configuration and Servlet API usage require engineering review before migration; safe automated transformation cannot be established from repository evidence alone.",
      affectedFiles: webSphereRuntime.metadata.evidenceRefs.map((r) => r.filePath),
      reason: "No target-runtime configuration equivalence has been established.",
      evidenceRefs: webSphereRuntime.metadata.evidenceRefs,
    });
  }
  const unresolvedDeps = directDeps.filter((d) => d.version === "unresolved");
  if (unresolvedDeps.length > 0) {
    manualReviews.push({
      id: nextReviewId(),
      topic: "Unresolved dependency version(s)",
      description: `${unresolvedDeps.length} direct dependenc${unresolvedDeps.length === 1 ? "y" : "ies"} could not be resolved locally and require manual review before migration.`,
      affectedFiles: [...new Set(unresolvedDeps.flatMap((d) => d.metadata.evidenceRefs.map((r) => r.filePath)))],
      reason: "Dependency version is a local property reference that could not be resolved from the repository model.",
      evidenceRefs: unresolvedDeps.flatMap((d) => d.metadata.evidenceRefs),
    });
  }

  const evidenceRefs = [
    ...dependencyChanges.flatMap((d) => d.evidenceRefs),
    ...configurationChanges.flatMap((c) => c.evidenceRefs),
    ...buildChanges.flatMap((b) => b.evidenceRefs),
    ...sourceCandidates.flatMap((s) => s.evidenceRefs),
  ];

  return { candidateId: candidate.id, dependencyChanges, configurationChanges, buildChanges, sourceCandidates, manualReviews, evidenceRefs };
}
