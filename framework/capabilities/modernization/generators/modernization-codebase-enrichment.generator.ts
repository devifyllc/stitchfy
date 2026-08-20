/**
 * Enriches an already-built ModernizationArchitecture with Phase 8.5A
 * codebase evidence for exactly one, explicitly-mapped system — never
 * inferred from a repository/artifact/package name (task item 37/100).
 * Additive only: fills the mapped profile's codebaseAnalysis reference-ids,
 * may append a narrow, evidence-only TechnicalDebtItem/MigrationValidationRequirement,
 * and may append a CodebaseEvidenceConflict. Never touches
 * MigrationCandidate.strategyOptions — strategy classification stays
 * Phase 8's own decision (task item 44/98/99).
 */

import type { ModernizationArchitecture, TechnicalDebtItem, MigrationValidationRequirement, CodebaseEvidenceConflict } from "../schemas/modernization.types.js";
import type { ModernizationNeed } from "../../../discovery/modernization/modernization-need.types.js";
import type { CodebaseAnalysisResult } from "../../../analysis/codebase/contracts/codebase-analysis-result.types.js";
import type { CodebaseEvidenceReference } from "../../../analysis/codebase/contracts/codebase-evidence.types.js";
import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";

export interface CodebaseEnrichmentResult {
  architecture: ModernizationArchitecture;
  applied: boolean;
  reason?: string;
}

const JAVA_VERSION_PATTERN = /\bJava\s+(\d+)\b/i;

function makeCounter(prefix: string, startAt: number) {
  let n = startAt;
  return () => `${prefix}-${String(++n).padStart(3, "0")}`;
}

export function enrichModernizationWithCodebaseAnalysis(
  architecture: ModernizationArchitecture,
  codebaseAnalysis: CodebaseAnalysisResult,
  systemId: string,
  need: ModernizationNeed | undefined
): CodebaseEnrichmentResult {
  const profile = architecture.profiles.find((p) => p.systemId === systemId);
  if (!profile) {
    // Explicit rule: a missing/invalid --system-id never silently maps the repository to another system (task item 100).
    return { architecture, applied: false, reason: `"${systemId}" is not an in-scope modernization system — no enrichment applied.` };
  }

  profile.codebaseAnalysis = {
    analysisId: codebaseAnalysis.repository.name,
    frameworkFactIds: codebaseAnalysis.frameworks.map((f) => f.id),
    runtimeFactIds: codebaseAnalysis.runtimes.map((r) => r.id),
    dependencyFactIds: codebaseAnalysis.dependencies.map((d) => d.id),
  };

  const newTechnicalDebt: TechnicalDebtItem[] = [];
  const nextDebtId = makeCounter("DEBT", architecture.technicalDebt.length);

  // Finding 1: duplicate direct dependency declarations (task item 48 — "analysis finding," never scored high).
  const directDeps = codebaseAnalysis.dependencies.filter((d) => d.direct === true);
  const byCoordinate = new Map<string, typeof directDeps>();
  for (const dep of directDeps) {
    const key = `${dep.ecosystem}:${dep.group ?? ""}:${dep.name}`;
    byCoordinate.set(key, [...(byCoordinate.get(key) ?? []), dep]);
  }
  for (const [key, deps] of byCoordinate) {
    if (deps.length < 2) continue;
    newTechnicalDebt.push({
      id: nextDebtId(),
      systemId,
      category: "dependencies",
      description: `Analysis finding: duplicate direct dependency declarations observed for ${key.replace(/^\w+:/, "")} (${deps.length} declarations).`,
      impact: "unknown",
      evidenceRefs: [],
      codebaseEvidenceRefs: deps.flatMap((d) => d.metadata.evidenceRefs),
    });
  }

  // Finding 2: an unresolved property-based dependency version.
  for (const dep of directDeps.filter((d) => d.version === "unresolved")) {
    newTechnicalDebt.push({
      id: nextDebtId(),
      systemId,
      category: "dependencies",
      description: `Analysis finding: dependency version for ${dep.group ? `${dep.group}:` : ""}${dep.name} could not be resolved locally.`,
      impact: "unknown",
      evidenceRefs: [],
      codebaseEvidenceRefs: dep.metadata.evidenceRefs,
    });
  }

  architecture.technicalDebt.push(...newTechnicalDebt);
  profile.technicalDebtIds.push(...newTechnicalDebt.map((d) => d.id));

  // MigrationValidationRequirement — only when it can link to a real, existing PreservationRequirement.
  const newValidationRequirements: MigrationValidationRequirement[] = [];
  const nextValidationId = makeCounter("VALIDATE", architecture.validationRequirements.length);

  const hasServletEvidence = codebaseAnalysis.frameworks.some((f) => f.name.startsWith("Servlet API"));
  if (hasServletEvidence) {
    const integrationContractRequirement = architecture.preservationRequirements.find((p) => p.systemId === systemId && p.type === "integration-contract");
    if (integrationContractRequirement) {
      const servletFact = codebaseAnalysis.frameworks.find((f) => f.name.startsWith("Servlet API"))!;
      newValidationRequirements.push({
        id: nextValidationId(),
        type: "behavior",
        description: "Verify preserved servlet behavior after runtime migration.",
        preservationRequirementIds: [integrationContractRequirement.id],
        evidenceRefs: integrationContractRequirement.evidenceRefs,
        codebaseEvidenceRefs: servletFact.metadata.evidenceRefs,
      });
    }
  }
  architecture.validationRequirements.push(...newValidationRequirements);

  // Conflict detection — one deterministic pair only: an explicit "Java N" statement in the modernization
  // need's own text vs. a codebase compiler-config RuntimeFact. Never silently pick one (task item 46).
  const conflicts: CodebaseEvidenceConflict[] = [];
  const nextConflictId = makeCounter("CONFLICT", architecture.codebaseEvidenceConflicts.length);

  if (need) {
    const discoveryText = [...need.desiredOutcomes, ...need.preservationNeeds, ...need.constraints].join(" ");
    const discoveryMatch = discoveryText.match(JAVA_VERSION_PATTERN);
    const codebaseJavaRuntime = codebaseAnalysis.runtimes.find((r) => r.type === "java" && r.detectionMethod === "compiler-config");

    if (discoveryMatch && codebaseJavaRuntime?.version && discoveryMatch[1] !== codebaseJavaRuntime.version) {
      const discoveryEvidence = [{ entityType: "modernization-need" as const, entityId: need.id, description: discoveryMatch[0] }];
      const codebaseEvidence: CodebaseEvidenceReference[] = codebaseJavaRuntime.metadata.evidenceRefs;
      conflicts.push({
        id: nextConflictId(),
        topic: "Java version",
        discoveryEvidence,
        codebaseEvidence,
        description: `Business discovery states "${discoveryMatch[0]}" while repository evidence shows a compiler source level of ${codebaseJavaRuntime.version}.`,
        resolution: "unresolved",
      });
    }
  }
  architecture.codebaseEvidenceConflicts.push(...conflicts);

  return { architecture, applied: true };
}

// ─── modernization-codebase-evidence artifact — a mapping, never a duplicate of the source analysis (task item 54) ──

function renderModernizationCodebaseEvidenceMarkdown(architecture: ModernizationArchitecture, codebaseAnalysis: CodebaseAnalysisResult, systemId: string): string {
  const lines: string[] = ["# Modernization ↔ Codebase Evidence", "", `_System: **${systemId}**, repository: **${codebaseAnalysis.repository.name}**_`, ""];
  lines.push(
    "> Stitchfy performed static, read-only analysis of selected repository files. It did not compile, execute, test, " +
      "deploy, or externally validate the application, and it did not query vulnerability or lifecycle databases. " +
      "Repository evidence does not select a modernization strategy.",
    ""
  );

  const profile = architecture.profiles.find((p) => p.systemId === systemId);

  lines.push("## Profile Mapping", "");
  if (!profile?.codebaseAnalysis) lines.push("No mapping — system not in modernization scope.");
  else {
    lines.push(`- Framework facts: ${profile.codebaseAnalysis.frameworkFactIds.join(", ") || "none"}`);
    lines.push(`- Runtime facts: ${profile.codebaseAnalysis.runtimeFactIds.join(", ") || "none"}`);
    lines.push(`- Dependency facts: ${profile.codebaseAnalysis.dependencyFactIds.join(", ") || "none"}`);
  }
  lines.push("");

  lines.push("## Analysis Findings", "");
  const findings = architecture.technicalDebt.filter((t) => t.systemId === systemId && t.codebaseEvidenceRefs?.length);
  if (findings.length === 0) lines.push("None.");
  else for (const f of findings) lines.push(`- ${f.description}`);
  lines.push("");

  lines.push("## Validation Requirements From Repository Evidence", "");
  const validations = architecture.validationRequirements.filter((v) => v.codebaseEvidenceRefs?.length);
  if (validations.length === 0) lines.push("None.");
  else for (const v of validations) lines.push(`- ${v.description}`);
  lines.push("");

  lines.push("## Evidence Conflicts", "");
  if (architecture.codebaseEvidenceConflicts.length === 0) lines.push("None.");
  else for (const c of architecture.codebaseEvidenceConflicts) lines.push(`- **${c.topic}** _(${c.resolution})_ — ${c.description}`);
  lines.push("");

  return lines.join("\n");
}

export function buildModernizationCodebaseEvidenceArtifacts(architecture: ModernizationArchitecture, codebaseAnalysis: CodebaseAnalysisResult, systemId: string): ImplementationArtifact[] {
  const profile = architecture.profiles.find((p) => p.systemId === systemId);
  const mapping = {
    systemId,
    analysisId: codebaseAnalysis.repository.name,
    profileMapping: profile?.codebaseAnalysis ?? null,
    findings: architecture.technicalDebt.filter((t) => t.systemId === systemId && t.codebaseEvidenceRefs?.length),
    validationRequirements: architecture.validationRequirements.filter((v) => v.codebaseEvidenceRefs?.length),
    conflicts: architecture.codebaseEvidenceConflicts,
  };

  return [
    createArtifact({ capabilityId: "modernization", type: "config", path: "analysis/codebase/modernization-codebase-evidence.json", content: JSON.stringify(mapping, null, 2) }),
    createArtifact({ capabilityId: "modernization", type: "document", path: "analysis/codebase/modernization-codebase-evidence.md", content: renderModernizationCodebaseEvidenceMarkdown(architecture, codebaseAnalysis, systemId) }),
  ];
}
